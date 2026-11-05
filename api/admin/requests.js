import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { generateSurnameRefId, formatMemberRefId, normalizeSurnameLetters } from '../../lib/id-generator.js';
import { createLockManager } from '../../lib/lock.js';
import { checkDuplicates, normalizeEmail, normalizePhone, normalizeName } from '../../lib/duplicates.js';
import { convertDropdownToRelationships } from '../../lib/relationships.js';
import { logAuditEvent } from '../../lib/audit.js';
import { sendJson, sendError, parseBody, parseQuery, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const sheetsClient = getSheetsClient();
  const lockManager = createLockManager(sheetsClient);

  if (req.method === 'GET') {
    const query = parseQuery(req);
    try {
      const [rows, allSurnames, allPersons] = await Promise.all([
        sheetsClient.getRows(TABS.REQUESTS),
        sheetsClient.getRows(TABS.SURNAMES),
        sheetsClient.getRows(TABS.PERSONS)
      ]);

      const filtered = query.status ? rows.filter(r => r.status?.toLowerCase() === query.status.toLowerCase()) : rows;

      // Enhance ONBOARD_SURNAME requests with existing matching families for the Admin review screen
      const enriched = filtered.map(r => {
        if (r.type === 'ONBOARD_SURNAME') {
          let payload = {};
          try {
            payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : (r.payload_json || {});
          } catch (_) {}
          const sName = payload.surname || payload.surname_name || '';
          const sNorm = normalizeSurnameLetters(sName);
          const existingFamilies = allSurnames
            .filter(s => s.status === 'Approved' && (s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name)) === sNorm)
            .map(s => {
              const members = allPersons.filter(p => p.surname_ref_id === s.surname_ref_id && p.status === 'Approved');
              const h = members.find(p => String(p.founding_role).toUpperCase() === 'HUSBAND' || String(p.member_ref_id).endsWith('-0001') || String(p.member_ref_id).endsWith('-1'));
              const w = members.find(p => String(p.founding_role).toUpperCase() === 'WIFE' || String(p.member_ref_id).endsWith('-0002') || String(p.member_ref_id).endsWith('-2'));
              return {
                surname_ref_id: s.surname_ref_id,
                surname_name: s.surname_name,
                husband: h ? { name: h.full_name, member_ref_id: h.member_ref_id } : null,
                wife: w ? { name: w.full_name, member_ref_id: w.member_ref_id } : null
              };
            });
          return { ...r, existing_families: existingFamilies };
        }
        return r;
      });

      return sendJson(res, 200, { requests: enriched });
    } catch (err) { return sendError(res, 500, 'Failed to list requests', err.message); }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const { ticket_id, action, mail_verified, mail_verified_note, admin_remarks, admin_confirmed_different_family } = parseBody(req);
    const upperAction = String(action || '').toUpperCase();
    if (!ticket_id || !action) return sendError(res, 400, 'ticket_id and action required');

    try {
      const requests = await sheetsClient.getRows(TABS.REQUESTS);
      const reqRow = requests.find(r => r.ticket_id === ticket_id);
      if (!reqRow) return sendError(res, 404, 'Ticket not found');

      if (upperAction === 'UPDATE_VERIFICATION') {
        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
          mail_verified: String(Boolean(mail_verified)),
          mail_verified_note: mail_verified_note !== undefined ? mail_verified_note : reqRow.mail_verified_note
        });
        return sendJson(res, 200, { success: true, request: updated });
      }

      if (upperAction === 'REJECT') {
        if (!admin_remarks?.trim()) return sendError(res, 400, 'admin_remarks required when rejecting');
        const now = new Date().toISOString();
        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
          status: 'Rejected', admin_remarks: admin_remarks.trim(), decided_at: now
        });
        await logAuditEvent(sheetsClient, {
          admin: admin.sub || 'admin',
          action: `REJECT_${reqRow.type}`,
          entity: 'Requests',
          entity_id: ticket_id,
          previous_value: reqRow.status,
          updated_value: {
            status: 'Rejected',
            admin_remarks: admin_remarks.trim(),
            ticket_id
          },
          ticket_id
        });
        return sendJson(res, 200, { success: true, request: updated });
      }

      if (upperAction === 'APPROVE') {
        if (String(reqRow.mail_verified).toLowerCase() !== 'true') {
          return sendError(res, 400, 'Refused: Cannot approve request until "Mail verified" is confirmed.');
        }

        const payload = JSON.parse(reqRow.payload_json || '{}');
        const now = new Date().toISOString();

        if (reqRow.type === 'ONBOARD_SURNAME') {
          const surname = payload.surname || payload.surname_name;
          const husband = payload.husband || {};
          const wife = payload.wife || {};
          const allSurnames = await sheetsClient.getRows(TABS.SURNAMES);

          // Check if surname_norm already exists
          const surnameNorm = normalizeSurnameLetters(surname);
          const existingSameNormSurnames = allSurnames.filter(s =>
            s.status === 'Approved' &&
            (s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name)) === surnameNorm
          );

          if (existingSameNormSurnames.length > 0 && !admin_confirmed_different_family) {
            return sendError(res, 400, 'Existing families found with this surname. Admin confirmation ("different family") is required before approval.');
          }

          const surnameRefId = generateSurnameRefId(surname, new Set(allSurnames.map(s => s.surname_ref_id)));
          const lock = await lockManager.acquire(`lock_surname_seq_${surnameRefId}`);
          try {
            await sheetsClient.appendRow(TABS.SURNAMES, {
              surname_ref_id: surnameRefId,
              surname_name: surname,
              surname_norm: surnameNorm,
              status: 'Approved',
              last_seq: '2',
              created_at: now
            });
            const hId = randomUUID();
            const wId = randomUUID();
            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: hId, member_ref_id: formatMemberRefId(surnameRefId, 1), surname_ref_id: surnameRefId,
              first_name: husband.first_name || '', middle_name: husband.middle_name || '', last_name: husband.last_name || '',
              full_name: husband.full_name, name_norm: normalizeName(husband.full_name), gender: 'MALE',
              founding_role: 'HUSBAND',
              dob: husband.dob || '', is_deceased: String(Boolean(husband.is_deceased)), email: husband.email || '',
              email_norm: normalizeEmail(husband.email), phone: husband.phone || '', phone_norm: normalizePhone(husband.phone),
              status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: wId, member_ref_id: formatMemberRefId(surnameRefId, 2), surname_ref_id: surnameRefId,
              first_name: wife.first_name || '', middle_name: wife.middle_name || '', last_name: wife.last_name || '',
              full_name: wife.full_name, name_norm: normalizeName(wife.full_name), gender: 'FEMALE',
              founding_role: 'WIFE',
              dob: wife.dob || '', is_deceased: String(Boolean(wife.is_deceased)), email: wife.email || '',
              email_norm: normalizeEmail(wife.email), phone: wife.phone || '', phone_norm: normalizePhone(wife.phone),
              status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: hId, person_b_id: wId, type: 'SPOUSE_OF', status: 'Approved', created_at: now });
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: wId, person_b_id: hId, type: 'SPOUSE_OF', status: 'Approved', created_at: now });
            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, { status: 'Approved', decided_at: now, admin_remarks: admin_remarks || 'Approved' });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_ONBOARD_SURNAME',
              entity: 'Surnames',
              entity_id: surnameRefId,
              previous_value: reqRow.status,
              updated_value: {
                ticket_id,
                surname_ref_id: surnameRefId,
                surname_name: surname,
                surname_searched: payload.surname_searched || payload.search_term || '',
                surname_ref_ids_shown: payload.surname_ref_ids_shown || [],
                user_different_family_confirmed: Boolean(payload.different_family_confirmed),
                admin_confirmed_different_family: Boolean(admin_confirmed_different_family),
                admin_remarks: admin_remarks || 'Approved'
              },
              ticket_id
            });

            return sendJson(res, 200, { success: true, surname_ref_id: surnameRefId });
          } finally {
            await lock.release();
          }
        }

        if (reqRow.type === 'ADD_MEMBER') {
          const { surname_ref_id, person, relative_person_id, relationship_type } = payload;
          const lock = await lockManager.acquire(`lock_surname_seq_${surname_ref_id}`);
          try {
            const surnames = await sheetsClient.getRows(TABS.SURNAMES);
            const sRow = surnames.find(s => s.surname_ref_id === surname_ref_id);
            const nextSeq = parseInt(sRow.last_seq || '0', 10) + 1;
            const newMemRefId = formatMemberRefId(surname_ref_id, nextSeq);
            const newId = randomUUID();

            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: newId, member_ref_id: newMemRefId, surname_ref_id,
              first_name: person.first_name || '', middle_name: person.middle_name || '', last_name: person.last_name || '',
              full_name: person.full_name,
              name_norm: normalizeName(person.full_name), gender: person.gender || '', dob: person.dob || '',
              founding_role: '',
              is_deceased: String(Boolean(person.is_deceased)), email: person.email || '', email_norm: normalizeEmail(person.email),
              phone: person.phone || '', phone_norm: normalizePhone(person.phone), status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.updateRow(TABS.SURNAMES, sRow.__rowIndex, { last_seq: String(nextSeq) });
            const rels = convertDropdownToRelationships({ newPersonId: newId, existingPersonId: relative_person_id, dropdownRole: relationship_type, gender: person.gender });
            for (const r of rels) {
              await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: r.person_a_id, person_b_id: r.person_b_id, type: r.type, status: 'Approved', created_at: now });
            }
            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, { status: 'Approved', decided_at: now, admin_remarks: admin_remarks || 'Approved' });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_ADD_MEMBER',
              entity: 'Persons',
              entity_id: newMemRefId,
              previous_value: reqRow.status,
              updated_value: {
                ticket_id,
                member_ref_id: newMemRefId,
                surname_ref_id,
                full_name: person.full_name,
                admin_remarks: admin_remarks || 'Approved'
              },
              ticket_id
            });

            return sendJson(res, 200, { success: true, member_ref_id: newMemRefId });
          } finally {
            await lock.release();
          }
        }
      }
      return sendError(res, 400, `Unknown action: ${action}`);
    } catch (err) { return sendError(res, 500, 'Action failed', err.message); }
  }
}
