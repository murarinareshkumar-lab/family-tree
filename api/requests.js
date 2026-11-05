import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { checkDuplicates, normalizeEmail, normalizePhone, isMinor } from '../lib/duplicates.js';
import { logAuditEvent } from '../lib/audit.js';
import { composeFullName } from '../lib/security.js';
import { validateName, validateEmail, validatePhone, parseAndValidateDob } from '../lib/validation.js';
import { sendJson, sendError, parseBody, applyRateLimit } from '../lib/api-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed. Use POST.');
  if (!applyRateLimit(req, res, 30)) return;

  const body = parseBody(req);
  const { type, payload, requester_email } = body;
  if (!type || !payload) return sendError(res, 400, 'Missing required fields: type and payload');

  const sheetsClient = getSheetsClient();
  try {
    const [existingPersons, pendingRequests] = await Promise.all([
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.REQUESTS)
    ]);
    const flags = [];
    const fieldErrors = {};

    if (type === 'ONBOARD_SURNAME') {
      const surname = payload.surname || payload.surname_name;
      const husband = payload.husband || {};
      const wife = payload.wife || {};

      // Validate Surname Name
      const surRes = validateName(surname, true);
      if (!surRes.valid) fieldErrors['surname_name'] = surRes.error;

      // Validate Husband Name
      const hFirstRes = validateName(husband.first_name, true);
      if (!hFirstRes.valid) fieldErrors['husband.first_name'] = hFirstRes.error;
      const hMidRes = validateName(husband.middle_name, false);
      if (!hMidRes.valid) fieldErrors['husband.middle_name'] = hMidRes.error;
      const hLastRes = validateName(husband.last_name, true);
      if (!hLastRes.valid) fieldErrors['husband.last_name'] = hLastRes.error;

      // Validate Husband Email & Phone
      const hEmailRes = validateEmail(husband.email, true);
      if (!hEmailRes.valid) fieldErrors['husband.email'] = hEmailRes.error;
      const hPhoneRes = validatePhone(husband.phone, true);
      if (!hPhoneRes.valid) fieldErrors['husband.phone'] = hPhoneRes.error;

      // Validate Husband DOB (Must be 18+)
      const hDobRes = parseAndValidateDob(husband.dob, { minAge: 18 });
      if (!hDobRes.valid) fieldErrors['husband.dob'] = hDobRes.error;

      // Validate Wife Name
      const wFirstRes = validateName(wife.first_name, true);
      if (!wFirstRes.valid) fieldErrors['wife.first_name'] = wFirstRes.error;
      const wMidRes = validateName(wife.middle_name, false);
      if (!wMidRes.valid) fieldErrors['wife.middle_name'] = wMidRes.error;
      const wLastRes = validateName(wife.last_name, true);
      if (!wLastRes.valid) fieldErrors['wife.last_name'] = wLastRes.error;

      // Validate Wife Email & Phone
      const wEmailRes = validateEmail(wife.email, true);
      if (!wEmailRes.valid) fieldErrors['wife.email'] = wEmailRes.error;
      const wPhoneRes = validatePhone(wife.phone, true);
      if (!wPhoneRes.valid) fieldErrors['wife.phone'] = wPhoneRes.error;

      // Validate Wife DOB (Must be 18+)
      const wDobRes = parseAndValidateDob(wife.dob, { minAge: 18 });
      if (!wDobRes.valid) fieldErrors['wife.dob'] = wDobRes.error;

      if (Object.keys(fieldErrors).length > 0) {
        return sendJson(res, 400, { error: 'Validation failed', errors: fieldErrors });
      }

      // Normalized & cleaned data
      husband.first_name = hFirstRes.value;
      husband.middle_name = hMidRes.value;
      husband.last_name = hLastRes.value;
      husband.full_name = composeFullName(husband.first_name, husband.middle_name, husband.last_name);
      husband.email = hEmailRes.value;
      husband.phone = hPhoneRes.value;
      husband.dob = hDobRes.value; // YYYY-MM-DD

      wife.first_name = wFirstRes.value;
      wife.middle_name = wMidRes.value;
      wife.last_name = wLastRes.value;
      wife.full_name = composeFullName(wife.first_name, wife.middle_name, wife.last_name);
      wife.email = wEmailRes.value;
      wife.phone = wPhoneRes.value;
      wife.dob = wDobRes.value; // YYYY-MM-DD

      const dupH = checkDuplicates(husband, existingPersons, pendingRequests);
      if (dupH.blocked) return sendError(res, 409, dupH.reason);
      flags.push(...dupH.flags);

      const dupW = checkDuplicates(wife, existingPersons, pendingRequests);
      if (dupW.blocked) return sendError(res, 409, dupW.reason);
      flags.push(...dupW.flags);
    } else if (type === 'ADD_MEMBER') {
      const surname_ref_id = payload.surname_ref_id;
      const person = payload.person || {
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        full_name: payload.full_name,
        gender: payload.gender,
        dob: payload.dob,
        is_deceased: payload.is_deceased,
        email: payload.email,
        phone: payload.phone,
        father_person_id: payload.father_person_id,
        mother_person_id: payload.mother_person_id
      };

      if (!surname_ref_id) fieldErrors['surname_ref_id'] = 'Lineage is required';

      const pFirstRes = validateName(person.first_name, true);
      if (!pFirstRes.valid) fieldErrors['person.first_name'] = pFirstRes.error;
      const pMidRes = validateName(person.middle_name, false);
      if (!pMidRes.valid) fieldErrors['person.middle_name'] = pMidRes.error;
      const pLastRes = validateName(person.last_name, true);
      if (!pLastRes.valid) fieldErrors['person.last_name'] = pLastRes.error;

      const pDobRes = parseAndValidateDob(person.dob);
      if (!pDobRes.valid) fieldErrors['person.dob'] = pDobRes.error;

      const isDeceased = Boolean(person.is_deceased);
      const isAdult = pDobRes.valid && pDobRes.age >= 18;

      if (!isDeceased && isAdult) {
        const pEmailRes = validateEmail(person.email, true);
        if (!pEmailRes.valid) fieldErrors['person.email'] = pEmailRes.error;
        else person.email = pEmailRes.value;

        const pPhoneRes = validatePhone(person.phone, true);
        if (!pPhoneRes.valid) fieldErrors['person.phone'] = pPhoneRes.error;
        else person.phone = pPhoneRes.value;
      } else {
        if (person.email) {
          const pEmailRes = validateEmail(person.email, false);
          if (!pEmailRes.valid) fieldErrors['person.email'] = pEmailRes.error;
          else person.email = pEmailRes.value;
        }
        if (person.phone) {
          const pPhoneRes = validatePhone(person.phone, false);
          if (!pPhoneRes.valid) fieldErrors['person.phone'] = pPhoneRes.error;
          else person.phone = pPhoneRes.value;
        }
      }

      const relationship = payload.relationship || {};
      const relative_person_id = payload.relative_person_id || relationship.target_person_id;
      const relationship_type = payload.relationship_type || relationship.type;

      if (!relationship_type || !relative_person_id) {
        fieldErrors['relationship'] = 'Family connection and relative are required';
      }

      if (Object.keys(fieldErrors).length > 0) {
        return sendJson(res, 400, { error: 'Validation failed', errors: fieldErrors });
      }

      person.first_name = pFirstRes.value;
      person.middle_name = pMidRes.value;
      person.last_name = pLastRes.value;
      person.full_name = composeFullName(person.first_name, person.middle_name, person.last_name);
      if (pDobRes.valid) person.dob = pDobRes.value;

      const dupP = checkDuplicates(person, existingPersons, pendingRequests);
      if (dupH && dupP.blocked) return sendError(res, 409, dupP.reason);
      flags.push(...dupP.flags);
    }

    const ticketId = `TKT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const row = {
      ticket_id: ticketId,
      type,
      payload_json: JSON.stringify({ ...payload, duplicate_flags: flags }),
      requester_email: normalizeEmail(requester_email || payload.requester_email || payload.husband?.email || payload.person?.email || payload.email || ''),
      status: 'Pending',
      mail_verified: 'false',
      mail_verified_note: '',
      created_at: now,
      decided_at: '',
      admin_remarks: ''
    };

    await sheetsClient.appendRow(TABS.REQUESTS, row);
    await logAuditEvent(sheetsClient, {
      admin: 'public_user',
      action: `REQUEST_SUBMITTED_${type}`,
      entity: 'Requests',
      entity_id: ticketId,
      updated_value: row,
      ticket_id: ticketId
    });

    sendJson(res, 201, {
      success: true,
      ticket_id: ticketId,
      status: 'Pending',
      message: 'Request submitted successfully. To verify identity, email support with Ticket ID in subject.',
      duplicate_flags_detected: flags.length > 0 ? flags : undefined,
      verification_instructions: {
        support_email: process.env.SUPPORT_EMAIL || 'support@familytree.local',
        subject: `Ticket #${ticketId} - Verification`
      }
    });
  } catch (err) {
    sendError(res, 500, 'Failed to submit request', err.message);
  }
}
