import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { generateSurnameRefId, formatMemberRefId } from '../../lib/id-generator.js';
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
      const rows = await sheetsClient.getRows(TABS.REQUESTS);
      const filtered = query.status ? rows.filter(r => r.status?.toLowerCase() === query.status.toLowerCase()) : rows;
      return sendJson(res, 200, { requests: filtered });
    } catch (err) { return sendError(res, 500, 'Failed to list requests', err.message); }
  }

  if (req.method === 'PATCH') {
    const { ticket_id, action, mail_verified, mail_verified_note, admin_remarks } = parseBody(req);
    if (!ticket_id || !action) return sendError(res, 400, 'ticket_id and action required');

    try {
      const requests = await sheetsClient.getRows(TABS.REQUESTS);
      const reqRow = requests.find(r => r.ticket_id === ticket_id);
      if (!reqRow) return sendError(res, 404, 'Ticket not found');

      if (action === 'UPDATE_VERIFICATION') {
        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
          mail_verified: String(Boolean(mail_verified)),
          mail_verified_note: mail_verified_note !== undefined ? mail_verified_note : reqRow.mail_verified_note
        });
        return sendJson(res, 200, { success: true, request: updated });
      }

      if (action === 'REJECT') {
        if (!admin_remarks?.trim()) return sendError(res, 400, 'admin_remarks required when rejecting');
        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
          status: 'Rejected', admin_remarks: admin_remarks.trim(), decided_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, request: updated });
      }

      if (action === 'APPROVE') {
        if (String(reqRow.mail_verified).toLowerCase() !== 'true') {
          return sendError(res, 400, 'Refused: Cannot approve request until "Mail verified" is confirmed.');
        }

        const payload = JSON.parse(reqRow.payload_json || '{}');
        const now = new Date().toISOString();

        if (reqRow.type === 'ONBOARD_SURNAME') {
          const { surname, husband, wife } = payload;
          const allSurnames = await sheetsClient.getRows(TABS.SURNAMES);
          const surnameRefId = generateSurnameRefId(surname, new Set(allSurnames.map(s => s.surname_ref_id)));
          const lock = await lockManager.acquire(`lock_surname_seq_${surnameRefId}`);
          try {
            await sheetsClient.appendRow(TABS.SURNAMES, { surname_ref_id: surnameRefId, surname_name: surname, status: 'Approved', last_seq: '2', created_at: now });
            const hId = randomUUID();
            const wId = randomUUID();
            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: hId, member_ref_id: formatMemberRefId(surnameRefId, 1), surname_ref_id: surnameRefId,
              first_name: husband.first_name || '', middle_name: husband.middle_name || '', last_name: husband.last_name || '',
              full_name: husband.full_name, name_norm: normalizeName(husband.full_name), gender: 'MALE',
              dob: husband.dob || '', is_deceased: String(Boolean(husband.is_deceased)), email: husband.email || '',
              email_norm: normalizeEmail(husband.email), phone: husband.phone || '', phone_norm: normalizePhone(husband.phone),
              status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: wId, member_ref_id: formatMemberRefId(surnameRefId, 2), surname_ref_id: surnameRefId,
              first_name: wife.first_name || '', middle_name: wife.middle_name || '', last_name: wife.last_name || '',
              full_name: wife.full_name, name_norm: normalizeName(wife.full_name), gender: 'FEMALE',
              dob: wife.dob || '', is_deceased: String(Boolean(wife.is_deceased)), email: wife.email || '',
              email_norm: normalizeEmail(wife.email), phone: wife.phone || '', phone_norm: normalizePhone(wife.phone),
              status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: hId, person_b_id: wId, type: 'SPOUSE_OF', status: 'Approved', created_at: now });
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: wId, person_b_id: hId, type: 'SPOUSE_OF', status: 'Approved', created_at: now });
            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, { status: 'Approved', decided_at: now, admin_remarks: admin_remarks || 'Approved' });
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
              is_deceased: String(Boolean(person.is_deceased)), email: person.email || '', email_norm: normalizeEmail(person.email),
              phone: person.phone || '', phone_norm: normalizePhone(person.phone), status: 'Approved', verified_by_admin: 'true', created_at: now
            });
            await sheetsClient.updateRow(TABS.SURNAMES, sRow.__rowIndex, { last_seq: String(nextSeq) });
            const rels = convertDropdownToRelationships({ newPersonId: newId, existingPersonId: relative_person_id, dropdownRole: relationship_type, gender: person.gender });
            for (const r of rels) {
              await sheetsClient.appendRow(TABS.RELATIONSHIPS, { rel_id: randomUUID(), person_a_id: r.person_a_id, person_b_id: r.person_b_id, type: r.type, status: 'Approved', created_at: now });
            }
            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, { status: 'Approved', decided_at: now, admin_remarks: admin_remarks || 'Approved' });
            return sendJson(res, 200, { success: true, member_ref_id: newMemRefId });
          } finally {
            await lock.release();
          }
        }
      }
      return sendError(res, 400, `Unknown action: ${action}`);
    } catch (err) { return sendError(res, 500, err.message); }
  }
}
