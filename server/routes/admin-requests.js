import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import {
  generateFamilyRefId,
  generateMemberRefId,
  computeNextBranchNo,
  normalizeSurnameLetters
} from '../../lib/id-generator.js';
import { createLockManager } from '../../lib/lock.js';
import { checkDuplicates, normalizeEmail, normalizePhone, normalizeName } from '../../lib/duplicates.js';
import { validateRelationship, convertDropdownToRelationships } from '../../lib/relationships.js';
import { logAuditEvent } from '../../lib/audit.js';
import { sendJson, sendError, parseBody, parseQuery, requireAdmin } from '../../lib/api-helper.js';
import { sendApprovalEmail, sendRejectionEmail } from '../../lib/email.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const sheetsClient = getSheetsClient();
  const lockManager = createLockManager(sheetsClient);

  // -------------------------------------------------------------
  // GET: List and enrich requests
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    const query = parseQuery(req);
    try {
      const [rows, allSurnames, allPersons, allLinks] = await Promise.all([
        sheetsClient.getRows(TABS.REQUESTS),
        sheetsClient.getRows(TABS.SURNAMES),
        sheetsClient.getRows(TABS.PERSONS),
        sheetsClient.getRows(TABS.FAMILY_LINKS)
      ]);

      const filtered = query.status ? rows.filter(r => r.status?.toLowerCase() === query.status.toLowerCase()) : rows;

      // Enhance requests with context for Admin review
      const enriched = filtered.map(r => {
        let payload = {};
        try {
          payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : (r.payload_json || {});
        } catch (_) {}

        // Context 1: ONBOARD_SURNAME
        if (r.type === 'ONBOARD_SURNAME') {
          const sName = payload.surname || payload.surname_name || '';
          const sNorm = normalizeSurnameLetters(sName);

          const existingFamilies = allSurnames
            .filter(s => s.status === 'Approved' && (s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name)) === sNorm)
            .map(s => {
              const members = allPersons.filter(p => p.surname_ref_id === s.surname_ref_id && p.status === 'Approved');
              const h = members.find(p => String(p.founding_role).toUpperCase() === 'HUSBAND' || String(p.member_ref_id).endsWith('-0001') || String(p.member_ref_id).endsWith('-1'));
              const w = members.find(p => String(p.founding_role).toUpperCase() === 'WIFE' || String(p.member_ref_id).endsWith('-0002') || String(p.member_ref_id).endsWith('-2'));
              return {
                branch_no: s.branch_no || '1',
                surname_ref_id: s.surname_ref_id,
                surname_name: s.surname_name,
                husband: h ? { name: h.full_name, member_ref_id: h.member_ref_id } : null,
                wife: w ? { name: w.full_name, member_ref_id: w.member_ref_id } : null
              };
            });

          const otherPending = rows.filter(other =>
            other.ticket_id !== r.ticket_id &&
            other.status === 'Pending' &&
            other.type === 'ONBOARD_SURNAME' &&
            normalizeSurnameLetters(JSON.parse(other.payload_json || '{}').surname || '') === sNorm
          ).map(o => ({ ticket_id: o.ticket_id, created_at: o.created_at }));

          return { ...r, existing_families: existingFamilies, other_pending: otherPending };
        }

        // Context 2: LINK_FAMILIES / MERGE_FAMILIES / DELINK_FAMILIES
        if (r.type === 'LINK_FAMILIES' || r.type === 'MERGE_FAMILIES' || r.type === 'DELINK_FAMILIES') {
          const famA = allSurnames.find(s => s.surname_ref_id === payload.family_a_ref_id);
          const famB = allSurnames.find(s => s.surname_ref_id === payload.family_b_ref_id);
          const perA = payload.person_a_id ? allPersons.find(p => p.person_id === payload.person_a_id || p.member_ref_id === payload.person_a_id) : null;
          const perB = payload.person_b_id ? allPersons.find(p => p.person_id === payload.person_b_id || p.member_ref_id === payload.person_b_id) : null;

          return {
            ...r,
            family_a_details: famA ? { surname_ref_id: famA.surname_ref_id, surname_name: famA.surname_name, branch_no: famA.branch_no } : null,
            family_b_details: famB ? { surname_ref_id: famB.surname_ref_id, surname_name: famB.surname_name, branch_no: famB.branch_no } : null,
            person_a_details: perA ? { name: perA.full_name, member_ref_id: perA.member_ref_id } : null,
            person_b_details: perB ? { name: perB.full_name, member_ref_id: perB.member_ref_id } : null
          };
        }

        return r;
      });

      return sendJson(res, 200, { requests: enriched });
    } catch (err) {
      return sendError(res, 500, 'Failed to list requests', err.message);
    }
  }

  // -------------------------------------------------------------
  // POST / PATCH: Admin Decisions
  // -------------------------------------------------------------
  if (req.method === 'PATCH' || req.method === 'POST') {
    const {
      ticket_id,
      action,
      mail_verified,
      mail_verified_note,
      second_party_mail_verified,
      second_party_mail_note,
      admin_remarks,
      admin_confirmed_different_family,
      surviving_family_ref_id,
      survivor_person_id
    } = parseBody(req);

    const upperAction = String(action || '').toUpperCase();
    if (!ticket_id || !action) return sendError(res, 400, 'ticket_id and action required');

    try {
      const requests = await sheetsClient.getRows(TABS.REQUESTS);
      const reqRow = requests.find(r => r.ticket_id === ticket_id);
      if (!reqRow && upperAction !== 'UNDO_MERGE') return sendError(res, 404, 'Ticket not found');

      // Prevent duplicate processing if request is already finalized
      if (reqRow && (reqRow.status === 'Approved' || reqRow.status === 'Rejected' || reqRow.status === 'Delinked') && upperAction !== 'UNDO_MERGE' && upperAction !== 'UPDATE_VERIFICATION' && upperAction !== 'RECORD_PHONE_VERIFICATION') {
        return sendError(res, 400, 'This request has already been processed.');
      }

      // ACTION 1: UPDATE_VERIFICATION
      if (upperAction === 'UPDATE_VERIFICATION') {
        const updateData = {};
        if (mail_verified !== undefined) updateData.mail_verified = String(Boolean(mail_verified));
        if (mail_verified_note !== undefined) updateData.mail_verified_note = mail_verified_note;
        if (second_party_mail_verified !== undefined) updateData.second_party_mail_verified = String(Boolean(second_party_mail_verified));
        if (second_party_mail_note !== undefined) updateData.second_party_mail_note = second_party_mail_note;

        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, updateData);
        return sendJson(res, 200, { success: true, request: updated });
      }

      // ACTION 1.5: RECORD_PHONE_VERIFICATION (Fallback for elders/minors/deceased without email)
      if (upperAction === 'RECORD_PHONE_VERIFICATION') {
        const body = parseBody(req);
        const now = new Date().toISOString();
        const updateData = {
          phone_verified: 'true',
          phone_verified_by: body.phone_verified_by || admin.sub || 'admin',
          phone_verified_at: now,
          phone_verified_note: body.phone_verified_note || `Phone verification call completed by admin with ${body.phone_number || 'family contact'}`
        };

        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, updateData);
        await logAuditEvent(sheetsClient, {
          admin: admin.sub || 'admin',
          action: 'RECORD_PHONE_VERIFICATION',
          entity: 'Requests',
          entity_id: ticket_id,
          previous_value: reqRow.phone_verified || 'false',
          updated_value: updateData,
          ticket_id
        });
        return sendJson(res, 200, { success: true, request: updated });
      }

      // ACTION 2: REJECT (Requires admin_remarks)
      if (upperAction === 'REJECT') {
        if (!admin_remarks?.trim()) {
          return sendError(res, 400, 'admin_remarks required when rejecting a request');
        }
        const now = new Date().toISOString();
        const updated = await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
          status: 'Rejected',
          admin_remarks: admin_remarks.trim(),
          decided_at: now
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

        if (reqRow.requester_email) {
          try {
            await sendRejectionEmail({
              toEmail: reqRow.requester_email,
              fullName: '',
              ticketId: ticket_id,
              remarks: admin_remarks.trim()
            });
          } catch (mErr) {
            console.warn('[Admin] Rejection email note:', mErr.message);
          }
        }

        return sendJson(res, 200, { success: true, request: updated });
      }

      // ACTION 3: UNDO_MERGE
      if (upperAction === 'UNDO_MERGE') {
        const auditLogs = await sheetsClient.getRows(TABS.AUDIT_LOG);
        const mergeLog = auditLogs.find(l => l.ticket_id === ticket_id && l.action === 'APPROVE_SAME_PERSON_MERGE');
        if (!mergeLog) {
          return sendError(res, 404, 'Audit record for this merge was not found to perform undo');
        }

        let prevData = {};
        try {
          prevData = JSON.parse(mergeLog.previous_value || '{}');
        } catch (_) {}

        const { survivor_id, non_survivor_id, restored_relationships } = prevData;

        // Restore survivor's former_name
        const allPersons = await sheetsClient.getRows(TABS.PERSONS);
        const survivor = allPersons.find(p => p.person_id === survivor_id);
        const nonSurvivor = allPersons.find(p => p.person_id === non_survivor_id);

        if (survivor) {
          await sheetsClient.updateRow(TABS.PERSONS, survivor.__rowIndex, { former_name: '' });
        }
        if (nonSurvivor) {
          await sheetsClient.updateRow(TABS.PERSONS, nonSurvivor.__rowIndex, {
            status: 'Approved',
            merged_into_person_id: ''
          });
        }

        // Restore relationships
        if (Array.isArray(restored_relationships)) {
          for (const rel of restored_relationships) {
            if (rel.__rowIndex) {
              await sheetsClient.updateRow(TABS.RELATIONSHIPS, rel.__rowIndex, {
                person_a_id: rel.person_a_id,
                person_b_id: rel.person_b_id
              });
            }
          }
        }

        // Delink FamilyLinks entry
        const allLinks = await sheetsClient.getRows(TABS.FAMILY_LINKS);
        const linkEntry = allLinks.find(l => l.ticket_id === ticket_id);
        if (linkEntry) {
          await sheetsClient.updateRow(TABS.FAMILY_LINKS, linkEntry.__rowIndex, {
            status: 'Delinked',
            admin_remarks: 'Undo merge performed by administrator'
          });
        }

        await logAuditEvent(sheetsClient, {
          admin: admin.sub || 'admin',
          action: 'UNDO_SAME_PERSON_MERGE',
          entity: 'Persons',
          entity_id: survivor_id,
          previous_value: { survivor_id, non_survivor_id },
          updated_value: { status: 'Restored', ticket_id },
          ticket_id
        });

        return sendJson(res, 200, { success: true, message: 'Merge successfully reversed' });
      }

      // ACTION 4: APPROVE
      if (upperAction === 'APPROVE') {
        const payload = JSON.parse(reqRow.payload_json || '{}');
        const now = new Date().toISOString();

        // If admin confirms/updates verification during approval, persist to Google Sheets
        const updatesToReq = {};
        if (mail_verified === true || mail_verified === 'true') {
          updatesToReq.mail_verified = 'true';
          updatesToReq.mail_verified_note = mail_verified_note || 'Verified by admin during approval';
          reqRow.mail_verified = 'true';
          reqRow.mail_verified_note = updatesToReq.mail_verified_note;
        }
        if (second_party_mail_verified === true || second_party_mail_verified === 'true') {
          updatesToReq.second_party_mail_verified = 'true';
          updatesToReq.second_party_mail_note = second_party_mail_note || 'Verified by admin during approval';
          reqRow.second_party_mail_verified = 'true';
          reqRow.second_party_mail_note = updatesToReq.second_party_mail_note;
        }
        if (Object.keys(updatesToReq).length > 0) {
          await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, updatesToReq);
        }

        // -------------------------------------------------------
        // APPROVE: ONBOARD_SURNAME
        // -------------------------------------------------------
        if (reqRow.type === 'ONBOARD_SURNAME') {
          const surname = payload.surname || payload.surname_name;
          const husband = payload.husband || {};
          const wife = payload.wife || {};
          const isVerified =
            String(reqRow.mail_verified).toLowerCase() === 'true' ||
            String(reqRow.phone_verified).toLowerCase() === 'true' ||
            Boolean(husband?.is_deceased || wife?.is_deceased) ||
            Boolean(mail_verified === true || mail_verified === 'true');
          if (!isVerified) {
            return sendError(res, 400, 'Refused: Cannot approve request until verification is confirmed (by Email OTP or recorded Admin phone call).');
          }
          const allSurnames = await sheetsClient.getRows(TABS.SURNAMES);
          const allPersons = await sheetsClient.getRows(TABS.PERSONS);

          // Check if surname_norm already exists among approved families
          const surnameNorm = normalizeSurnameLetters(surname);
          const existingSameNormSurnames = allSurnames.filter(s =>
            s.status === 'Approved' &&
            (s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name)) === surnameNorm
          );

          if (existingSameNormSurnames.length > 0 && !admin_confirmed_different_family) {
            return sendError(res, 400, 'Existing families found with this surname. Admin confirmation ("different family branch") is required before approval.');
          }

          // ID_LOCK for safe collision-free assignment
          const lock = await lockManager.acquire('ID_LOCK', 8000);
          try {
            // Re-read under lock to check ALL existing IDs (including Rejected and Merged)
            const [curSurnames, curPersons] = await Promise.all([
              sheetsClient.getRows(TABS.SURNAMES),
              sheetsClient.getRows(TABS.PERSONS)
            ]);

            const allUsedFamilyIds = new Set(curSurnames.map(s => String(s.surname_ref_id || '').toUpperCase()));
            const allUsedMemberIds = new Set(curPersons.map(p => String(p.member_ref_id || '').toUpperCase()));

            // Generate FT-XXXXXX and PRD v4.0 SS-FFF-MMYYYY-NNN Member Reference IDs
            const familyRefId = generateFamilyRefId(allUsedFamilyIds);
            const hMemberRefId = generateMemberRefId({
              surname,
              firstName: husband.first_name || (husband.full_name ? husband.full_name.split(/\s+/)[0] : ''),
              dob: husband.dob
            }, allUsedMemberIds);
            allUsedMemberIds.add(hMemberRefId.toUpperCase());
            const wMemberRefId = generateMemberRefId({
              surname,
              firstName: wife.first_name || (wife.full_name ? wife.full_name.split(/\s+/)[0] : ''),
              dob: wife.dob
            }, allUsedMemberIds);

            // Compute branch_no
            const branchNo = computeNextBranchNo(surname, curSurnames);

            // 1. Write Surnames row
            await sheetsClient.appendRow(TABS.SURNAMES, {
              surname_ref_id: familyRefId,
              surname_name: surname,
              surname_norm: surnameNorm,
              branch_no: String(branchNo),
              merged_into_surname_ref_id: '',
              status: 'Approved',
              last_seq: '',
              created_at: now
            });

            // 2. Write Husband and Wife (approved as one unit)
            const hId = randomUUID();
            const wId = randomUUID();

            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: hId,
              member_ref_id: hMemberRefId,
              surname_ref_id: familyRefId,
              first_name: husband.first_name || '',
              middle_name: husband.middle_name || '',
              last_name: husband.last_name || '',
              full_name: husband.full_name,
              former_name: '',
              name_norm: normalizeName(husband.full_name),
              gender: 'MALE',
              founding_role: 'HUSBAND',
              dob: husband.dob || '',
              is_deceased: String(Boolean(husband.is_deceased)),
              email: husband.email || '',
              email_norm: normalizeEmail(husband.email),
              phone: husband.phone || '',
              phone_norm: normalizePhone(husband.phone),
              status: 'Approved',
              verified_by_admin: 'true',
              created_at: now
            });

            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: wId,
              member_ref_id: wMemberRefId,
              surname_ref_id: familyRefId,
              first_name: wife.first_name || '',
              middle_name: wife.middle_name || '',
              last_name: wife.last_name || '',
              full_name: wife.full_name,
              former_name: '',
              name_norm: normalizeName(wife.full_name),
              gender: 'FEMALE',
              founding_role: 'WIFE',
              dob: wife.dob || '',
              is_deceased: String(Boolean(wife.is_deceased)),
              marital_status: 'Married',
              surname_before_marriage: wife.surname_before_marriage || wife.maiden_surname || '',
              email: wife.email || '',
              email_norm: normalizeEmail(wife.email),
              phone: wife.phone || '',
              phone_norm: normalizePhone(wife.phone),
              status: 'Approved',
              verified_by_admin: 'true',
              created_at: now
            });

            // 3. Reciprocal SPOUSE_OF links
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, {
              rel_id: randomUUID(),
              person_a_id: hId,
              person_b_id: wId,
              type: 'SPOUSE_OF',
              status: 'Approved',
              created_at: now
            });
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, {
              rel_id: randomUUID(),
              person_a_id: wId,
              person_b_id: hId,
              type: 'SPOUSE_OF',
              status: 'Approved',
              created_at: now
            });

            // 4. Update Request status
            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
              status: 'Approved',
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            // 5. Audit Log
            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_ONBOARD_SURNAME',
              entity: 'Surnames',
              entity_id: familyRefId,
              previous_value: reqRow.status,
              updated_value: {
                ticket_id,
                surname_ref_id: familyRefId,
                branch_no: branchNo,
                husband_member_ref_id: hMemberRefId,
                wife_member_ref_id: wMemberRefId,
                surname_name: surname,
                user_different_family_confirmed: Boolean(payload.different_family_confirmed),
                admin_confirmed_different_family: Boolean(admin_confirmed_different_family),
                admin_remarks: admin_remarks || 'Approved'
              },
              ticket_id
            });

            if (reqRow.requester_email) {
              try {
                await sendApprovalEmail({
                  toEmail: reqRow.requester_email,
                  fullName: husband.full_name || '',
                  ticketId: ticket_id,
                  memberRefId: hMemberRefId
                });
              } catch (mErr) {
                console.warn('[Admin] Approval email note:', mErr.message);
              }
            }

            return sendJson(res, 200, {
              success: true,
              surname_ref_id: familyRefId,
              branch_no: branchNo,
              husband_member_ref_id: hMemberRefId,
              wife_member_ref_id: wMemberRefId
            });
          } finally {
            await lock.release();
          }
        }

        // -------------------------------------------------------
        // APPROVE: ADD_MEMBER / JOIN_REQUEST
        // -------------------------------------------------------
        if (reqRow.type === 'ADD_MEMBER' || reqRow.type === 'JOIN_REQUEST') {
          const { surname_ref_id, person = {}, relative_person_id, relationship_type } = payload;
          const isVerified =
            String(reqRow.mail_verified).toLowerCase() === 'true' ||
            String(reqRow.phone_verified).toLowerCase() === 'true' ||
            Boolean(person?.is_deceased) ||
            Boolean(mail_verified === true || mail_verified === 'true');
          if (!isVerified) {
            return sendError(res, 400, 'Refused: Cannot approve request until verification is confirmed (by Email OTP or recorded Admin phone call).');
          }

          const relType = String(relationship_type || '').toUpperCase();

          const lock = await lockManager.acquire('ID_LOCK', 8000);
          try {
            const [curPersons, curRelationships] = await Promise.all([
              sheetsClient.getRows(TABS.PERSONS),
              sheetsClient.getRows(TABS.RELATIONSHIPS)
            ]);

            const allUsedMemberIds = new Set(curPersons.map(p => String(p.member_ref_id || '').toUpperCase()));
            const newMemberRefId = generateMemberRefId({
              surname: person.last_name || (person.full_name ? person.full_name.split(/\s+/).pop() : ''),
              firstName: person.first_name || (person.full_name ? person.full_name.split(/\s+/)[0] : ''),
              dob: person.dob
            }, allUsedMemberIds);
            const newPersonId = randomUUID();

            // Resolve relative
            const relative = curPersons.find(p => p.person_id === relative_person_id || p.member_ref_id === relative_person_id);
            if (!relative) return sendError(res, 400, 'Relative not found');

            // Validate relationships
            const primitiveRels = convertDropdownToRelationships(relType, newPersonId, relative.person_id);
            for (const r of primitiveRels) {
              const check = validateRelationship({
                personAId: r.person_a_id,
                personBId: r.person_b_id,
                type: r.type,
                existingRelationships: curRelationships,
                persons: [...curPersons, { ...person, person_id: newPersonId }]
              });
              if (!check.valid) return sendError(res, 400, `Relationship validation failed: ${check.error}`);
            }

            // Append new person
            await sheetsClient.appendRow(TABS.PERSONS, {
              person_id: newPersonId,
              member_ref_id: newMemberRefId,
              surname_ref_id: surname_ref_id,
              first_name: person.first_name || '',
              middle_name: person.middle_name || '',
              last_name: person.last_name || '',
              full_name: person.full_name,
              former_name: '',
              name_norm: normalizeName(person.full_name),
              gender: person.gender || 'UNKNOWN',
              founding_role: '',
              dob: person.dob || '',
              is_deceased: String(Boolean(person.is_deceased)),
              marital_status: person.marital_status || (person.relationship_type === 'SPOUSE' || relType === 'SPOUSE' || relType === 'SPOUSE_OF' ? 'Married' : ''),
              surname_before_marriage: person.surname_before_marriage || person.maiden_surname || '',
              email: person.email || '',
              email_norm: normalizeEmail(person.email),
              phone: person.phone || '',
              phone_norm: normalizePhone(person.phone),
              father_person_id: person.father_person_id || '',
              mother_person_id: person.mother_person_id || '',
              status: 'Approved',
              verified_by_admin: 'true',
              created_at: now
            });

            // Append relationships
            for (const r of primitiveRels) {
              await sheetsClient.appendRow(TABS.RELATIONSHIPS, {
                rel_id: randomUUID(),
                person_a_id: r.person_a_id,
                person_b_id: r.person_b_id,
                type: r.type,
                status: 'Approved',
                created_at: now
              });
            }

            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
              status: 'Approved',
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_ADD_MEMBER',
              entity: 'Persons',
              entity_id: newPersonId,
              previous_value: reqRow.status,
              updated_value: {
                ticket_id,
                member_ref_id: newMemberRefId,
                person_id: newPersonId,
                surname_ref_id,
                relative_person_id: relative.person_id,
                relationship_type: relType
              },
              ticket_id
            });

            if (reqRow.requester_email) {
              try {
                await sendApprovalEmail({
                  toEmail: reqRow.requester_email,
                  fullName: person.full_name || payload.submitter_name || '',
                  ticketId: ticket_id,
                  memberRefId: newMemberRefId
                });
              } catch (mErr) {
                console.warn('[Admin] Approval email note:', mErr.message);
              }
            }

            return sendJson(res, 200, { success: true, member_ref_id: newMemberRefId, person_id: newPersonId });
          } finally {
            await lock.release();
          }
        }

        // -------------------------------------------------------
        // APPROVE: LINK_FAMILIES / MERGE_FAMILIES
        // -------------------------------------------------------
        if (reqRow.type === 'LINK_FAMILIES' || reqRow.type === 'MERGE_FAMILIES') {
          // Both parties' registered emails MUST be verified
          const partyAVerified = String(reqRow.mail_verified).toLowerCase() === 'true';
          const partyBVerified = String(reqRow.second_party_mail_verified).toLowerCase() === 'true';

          if (!partyAVerified || !partyBVerified) {
            return sendError(
              res,
              400,
              'Refused: Cannot approve link/merge until BOTH parties have verified mail ownership (mail_verified and second_party_mail_verified must both be checked).'
            );
          }

          const { link_type, family_a_ref_id, family_b_ref_id, person_a_id, person_b_id, relation_note } = payload;
          const linkId = randomUUID();

          // Sub-case A: MERGE_FAMILIES
          if (link_type === 'MERGE_FAMILIES') {
            const survivorFamId = surviving_family_ref_id || payload.surviving_family_ref_id || family_a_ref_id;
            const retiredFamId = (survivorFamId === family_a_ref_id) ? family_b_ref_id : family_a_ref_id;

            const allSurnames = await sheetsClient.getRows(TABS.SURNAMES);
            const allPersons = await sheetsClient.getRows(TABS.PERSONS);

            const retiredFamRow = allSurnames.find(s => s.surname_ref_id === retiredFamId);
            if (!retiredFamRow) return sendError(res, 404, `Retired family ${retiredFamId} not found`);

            // 1. Retired family becomes Merged
            await sheetsClient.updateRow(TABS.SURNAMES, retiredFamRow.__rowIndex, {
              status: 'Merged',
              merged_into_surname_ref_id: survivorFamId
            });

            // 2. Members moved to survivor family, member_ref_ids unchanged, founding_role cleared
            const retiredMembers = allPersons.filter(p => p.surname_ref_id === retiredFamId);
            for (const mem of retiredMembers) {
              await sheetsClient.updateRow(TABS.PERSONS, mem.__rowIndex, {
                surname_ref_id: survivorFamId,
                founding_role: '' // Retired founding roles cleared
              });
            }

            // 3. Write FamilyLinks row
            await sheetsClient.appendRow(TABS.FAMILY_LINKS, {
              link_id: linkId,
              link_type: 'MERGE_FAMILIES',
              family_a_ref_id: survivorFamId,
              family_b_ref_id: retiredFamId,
              person_a_id: '',
              person_b_id: '',
              relation_note: relation_note || 'Families merged into single branch',
              ticket_id,
              status: 'Approved',
              created_at: now,
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
              status: 'Approved',
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_MERGE_FAMILIES',
              entity: 'Surnames',
              entity_id: survivorFamId,
              previous_value: { retired_family: retiredFamId, members_count: retiredMembers.length },
              updated_value: { survivor_family: survivorFamId, merged_into_surname_ref_id: survivorFamId },
              ticket_id
            });

            return sendJson(res, 200, { success: true, link_id: linkId, message: `Family ${retiredFamId} merged into ${survivorFamId}` });
          }

          // Sub-case B: SAME_PERSON
          if (link_type === 'SAME_PERSON') {
            const allPersons = await sheetsClient.getRows(TABS.PERSONS);
            const allRelationships = await sheetsClient.getRows(TABS.RELATIONSHIPS);

            const survivorId = survivor_person_id || payload.survivor_person_id || person_a_id;
            const nonSurvivorId = (survivorId === person_a_id) ? person_b_id : person_a_id;

            const survivorPerson = allPersons.find(p => p.person_id === survivorId || p.member_ref_id === survivorId);
            const nonSurvivorPerson = allPersons.find(p => p.person_id === nonSurvivorId || p.member_ref_id === nonSurvivorId);

            if (!survivorPerson || !nonSurvivorPerson) {
              return sendError(res, 404, 'One or both person records not found');
            }

            // Save previous state for undo capability
            const affectedRels = allRelationships.filter(r =>
              r.person_a_id === nonSurvivorPerson.person_id || r.person_b_id === nonSurvivorPerson.person_id
            );

            // 1. Re-point relationships to survivor
            for (const r of affectedRels) {
              const newA = r.person_a_id === nonSurvivorPerson.person_id ? survivorPerson.person_id : r.person_a_id;
              const newB = r.person_b_id === nonSurvivorPerson.person_id ? survivorPerson.person_id : r.person_b_id;
              await sheetsClient.updateRow(TABS.RELATIONSHIPS, r.__rowIndex, {
                person_a_id: newA,
                person_b_id: newB
              });
            }

            // 2. Set former_name on survivor
            await sheetsClient.updateRow(TABS.PERSONS, survivorPerson.__rowIndex, {
              former_name: nonSurvivorPerson.full_name
            });

            // 3. Mark non-survivor as Merged
            await sheetsClient.updateRow(TABS.PERSONS, nonSurvivorPerson.__rowIndex, {
              status: 'Merged',
              merged_into_person_id: survivorPerson.person_id
            });

            // 4. Save to FamilyLinks
            await sheetsClient.appendRow(TABS.FAMILY_LINKS, {
              link_id: linkId,
              link_type: 'SAME_PERSON',
              family_a_ref_id,
              family_b_ref_id,
              person_a_id: survivorPerson.person_id,
              person_b_id: nonSurvivorPerson.person_id,
              relation_note: relation_note || `Same person across families (${survivorPerson.full_name})`,
              ticket_id,
              status: 'Approved',
              created_at: now,
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
              status: 'Approved',
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_SAME_PERSON_MERGE',
              entity: 'Persons',
              entity_id: survivorPerson.person_id,
              previous_value: {
                survivor_id: survivorPerson.person_id,
                non_survivor_id: nonSurvivorPerson.person_id,
                restored_relationships: affectedRels
              },
              updated_value: {
                survivor_person: survivorPerson.full_name,
                former_name: nonSurvivorPerson.full_name,
                repointed_rels_count: affectedRels.length
              },
              ticket_id
            });

            return sendJson(res, 200, { success: true, link_id: linkId, message: 'Person merged successfully' });
          }

          // Sub-case C: PARENT_CHILD
          if (link_type === 'PARENT_CHILD') {
            const allPersons = await sheetsClient.getRows(TABS.PERSONS);
            const parent = allPersons.find(p => p.person_id === person_a_id || p.member_ref_id === person_a_id);
            const child = allPersons.find(p => p.person_id === person_b_id || p.member_ref_id === person_b_id);

            if (!parent || !child) return sendError(res, 404, 'Parent or child record not found');

            // Add PARENT_OF link so child's family hangs under parent's
            await sheetsClient.appendRow(TABS.RELATIONSHIPS, {
              rel_id: randomUUID(),
              person_a_id: parent.person_id,
              person_b_id: child.person_id,
              type: 'PARENT_OF',
              status: 'Approved',
              created_at: now
            });

            await sheetsClient.appendRow(TABS.FAMILY_LINKS, {
              link_id: linkId,
              link_type: 'PARENT_CHILD',
              family_a_ref_id,
              family_b_ref_id,
              person_a_id: parent.person_id,
              person_b_id: child.person_id,
              relation_note: relation_note || 'Cross-family parent-child connection',
              ticket_id,
              status: 'Approved',
              created_at: now,
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
              status: 'Approved',
              decided_at: now,
              admin_remarks: admin_remarks || 'Approved'
            });

            await logAuditEvent(sheetsClient, {
              admin: admin.sub || 'admin',
              action: 'APPROVE_PARENT_CHILD_LINK',
              entity: 'FamilyLinks',
              entity_id: linkId,
              previous_value: reqRow.status,
              updated_value: { parent_id: parent.person_id, child_id: child.person_id, family_a_ref_id, family_b_ref_id },
              ticket_id
            });

            return sendJson(res, 200, { success: true, link_id: linkId, message: 'Parent-child link created' });
          }
        }

        // -------------------------------------------------------
        // APPROVE: DELINK_FAMILIES
        // -------------------------------------------------------
        if (reqRow.type === 'DELINK_FAMILIES') {
          if (String(reqRow.mail_verified).toLowerCase() !== 'true') {
            return sendError(res, 400, 'Refused: Cannot approve delink until "Mail verified" is confirmed.');
          }

          const { family_a_ref_id, family_b_ref_id, link_id } = payload;
          const allLinks = await sheetsClient.getRows(TABS.FAMILY_LINKS);
          const allRelationships = await sheetsClient.getRows(TABS.RELATIONSHIPS);

          const linkRow = allLinks.find(l =>
            (link_id && l.link_id === link_id) ||
            (l.status === 'Approved' &&
              ((l.family_a_ref_id === family_a_ref_id && l.family_b_ref_id === family_b_ref_id) ||
               (l.family_a_ref_id === family_b_ref_id && l.family_b_ref_id === family_a_ref_id)))
          );

          if (!linkRow) return sendError(res, 404, 'Active link between these families was not found');

          // Update FamilyLinks status
          await sheetsClient.updateRow(TABS.FAMILY_LINKS, linkRow.__rowIndex, {
            status: 'Delinked',
            decided_at: now,
            admin_remarks: admin_remarks || 'Delinked by administrator'
          });

          // If PARENT_CHILD, mark relationship as Removed
          if (linkRow.link_type === 'PARENT_CHILD' && linkRow.person_a_id && linkRow.person_b_id) {
            const rel = allRelationships.find(r =>
              r.status === 'Approved' && r.person_a_id === linkRow.person_a_id && r.person_b_id === linkRow.person_b_id && r.type === 'PARENT_OF'
            );
            if (rel) {
              await sheetsClient.updateRow(TABS.RELATIONSHIPS, rel.__rowIndex, { status: 'Removed' });
            }
          }

          await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
            status: 'Approved',
            decided_at: now,
            admin_remarks: admin_remarks || 'Approved delink'
          });

          await logAuditEvent(sheetsClient, {
            admin: admin.sub || 'admin',
            action: 'APPROVE_DELINK_FAMILIES',
            entity: 'FamilyLinks',
            entity_id: linkRow.link_id,
            previous_value: linkRow.status,
            updated_value: { status: 'Delinked', ticket_id },
            ticket_id
          });

          return sendJson(res, 200, { success: true, message: 'Families successfully delinked' });
        }

        // -------------------------------------------------------
        // APPROVE: EDIT_UPDATE_MEMBER / EDIT_MEMBER / UPDATE_MEMBER
        // -------------------------------------------------------
        if (reqRow.type === 'EDIT_MEMBER' || reqRow.type === 'UPDATE_MEMBER' || reqRow.type === 'EDIT_UPDATE_MEMBER') {
          const { member_ref_id, person_id, updated_details = {}, requested_changes = {} } = payload;
          const targetRef = member_ref_id || payload.member_ref;
          const targetId = person_id || payload.person_id;

          const allPersons = await sheetsClient.getRows(TABS.PERSONS);
          const personRow = allPersons.find(p =>
            (targetRef && String(p.member_ref_id || '').toUpperCase() === String(targetRef).toUpperCase()) ||
            (targetId && p.person_id === targetId)
          );

          if (!personRow) {
            return sendError(res, 404, 'Member record not found to update');
          }

          // Allowed updatable fields - Member Reference ID is STRICTLY PERMANENT
          const changes = { ...requested_changes, ...updated_details };
          const updateData = {};
          if (changes.first_name) updateData.first_name = changes.first_name;
          if (changes.middle_name !== undefined) updateData.middle_name = changes.middle_name;
          if (changes.last_name) updateData.last_name = changes.last_name;
          if (changes.first_name || changes.last_name) {
            const m = changes.middle_name ? ` ${changes.middle_name}` : '';
            updateData.full_name = `${changes.first_name || personRow.first_name}${m} ${changes.last_name || personRow.last_name}`;
            updateData.name_norm = normalizeName(updateData.full_name);
          }
          if (changes.dob) updateData.dob = changes.dob;
          if (changes.gender) updateData.gender = changes.gender;
          if (changes.phone) {
            updateData.phone = changes.phone;
            updateData.phone_norm = normalizePhone(changes.phone);
          }
          if (changes.email) {
            updateData.email = changes.email;
            updateData.email_norm = normalizeEmail(changes.email);
          }
          if (changes.occupation) updateData.occupation = changes.occupation;
          if (changes.location) updateData.location = changes.location;
          if (changes.marital_status) updateData.marital_status = changes.marital_status;

          // Apply update to person
          await sheetsClient.updateRow(TABS.PERSONS, personRow.__rowIndex, updateData);

          // Update request status
          await sheetsClient.updateRow(TABS.REQUESTS, reqRow.__rowIndex, {
            status: 'Approved',
            decided_at: now,
            admin_remarks: admin_remarks || 'Approved member update'
          });

          // Audit log
          await logAuditEvent(sheetsClient, {
            admin: admin.sub || 'admin',
            action: 'APPROVE_EDIT_MEMBER',
            entity: 'Persons',
            entity_id: personRow.person_id,
            previous_value: { full_name: personRow.full_name, phone: personRow.phone, email: personRow.email, member_ref_id: personRow.member_ref_id },
            updated_value: { ...updateData, member_ref_id: personRow.member_ref_id },
            ticket_id
          });

          if (reqRow.requester_email || personRow.email) {
            try {
              await sendApprovalEmail({
                toEmail: reqRow.requester_email || personRow.email,
                fullName: personRow.full_name,
                ticketId: ticket_id,
                memberRefId: personRow.member_ref_id
              });
            } catch (mErr) {
              console.warn('[Admin] Approval email note:', mErr.message);
            }
          }

          return sendJson(res, 200, {
            success: true,
            member_ref_id: personRow.member_ref_id,
            message: 'Member details successfully updated'
          });
        }
      }

      return sendError(res, 400, `Unknown or unsupported action: ${action}`);
    } catch (err) {
      return sendError(res, 500, 'Failed to process request', err.message);
    }
  }
}
