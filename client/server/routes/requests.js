import express from 'express';
import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { checkDuplicates, checkA4FamilyMatch, normalizeEmail, normalizePhone, isMinor } from '../../lib/duplicates.js';
import { normalizeSurnameLetters } from '../../lib/id-generator.js';
import { validateRelationship, convertDropdownToRelationships } from '../../lib/relationships.js';
import { logAuditEvent } from '../../lib/audit.js';
import { composeFullName } from '../../lib/security.js';
import { validateName, validateEmail, validatePhone, parseAndValidateDob } from '../../lib/validation.js';
import { verifyVerificationToken } from '../../lib/otp.js';
import { sendTicketReceivedEmail } from '../../lib/email.js';

const router = express.Router();

// GET /api/requests/status?ticket_id=...
router.get('/status', async (req, res, next) => {
  const ticketId = (req.query.ticket_id || '').trim().toUpperCase();
  if (!ticketId) {
    return res.status(400).json({ error: 'ticket_id is required' });
  }

  try {
    const sheetsClient = getSheetsClient();
    const rows = await sheetsClient.getRows(TABS.REQUESTS);
    const t = rows.find(r => r.ticket_id === ticketId);
    if (!t) {
      return res.status(404).json({ error: `Ticket #${ticketId} not found` });
    }

    res.json({
      ticket_id: t.ticket_id,
      type: t.type,
      status: t.status,
      mail_verified: String(t.mail_verified).toLowerCase() === 'true',
      second_party_mail_verified: String(t.second_party_mail_verified).toLowerCase() === 'true',
      created_at: t.created_at,
      decided_at: t.decided_at || null,
      admin_remarks: t.admin_remarks || null,
      verification_instructions: {
        support_email: process.env.SUPPORT_EMAIL || 'support.familytree@gmail.com',
        subject: `Ticket #${t.ticket_id} - Verification`
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests
router.post('/', async (req, res, next) => {
  const { type, payload, requester_email } = req.body || {};
  if (!type || !payload) {
    return res.status(400).json({ error: 'Missing required fields: type and payload' });
  }

  const sheetsClient = getSheetsClient();
  try {
    const [existingPersons, pendingRequests, allSurnames, allRelationships, allLinks] = await Promise.all([
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.REQUESTS),
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.RELATIONSHIPS),
      sheetsClient.getRows(TABS.FAMILY_LINKS)
    ]);
    const flags = [];
    const fieldErrors = {};

    // ---------------------------------------------------------
    // 1. ONBOARD_SURNAME
    // ---------------------------------------------------------
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

      // Validate Husband Email & Phone & DOB
      const hEmailRes = validateEmail(husband.email, true);
      if (!hEmailRes.valid) fieldErrors['husband.email'] = hEmailRes.error;
      const hPhoneRes = validatePhone(husband.phone, true);
      if (!hPhoneRes.valid) fieldErrors['husband.phone'] = hPhoneRes.error;
      const hDobRes = parseAndValidateDob(husband.dob, { minAge: 18 });
      if (!hDobRes.valid) fieldErrors['husband.dob'] = hDobRes.error;

      // Validate Wife Name
      const wFirstRes = validateName(wife.first_name, true);
      if (!wFirstRes.valid) fieldErrors['wife.first_name'] = wFirstRes.error;
      const wMidRes = validateName(wife.middle_name, false);
      if (!wMidRes.valid) fieldErrors['wife.middle_name'] = wMidRes.error;
      const wLastRes = validateName(wife.last_name, true);
      if (!wLastRes.valid) fieldErrors['wife.last_name'] = wLastRes.error;

      // Validate Wife Email & Phone & DOB
      const wEmailRes = validateEmail(wife.email, true);
      if (!wEmailRes.valid) fieldErrors['wife.email'] = wEmailRes.error;
      const wPhoneRes = validatePhone(wife.phone, true);
      if (!wPhoneRes.valid) fieldErrors['wife.phone'] = wPhoneRes.error;
      const wDobRes = parseAndValidateDob(wife.dob, { minAge: 18 });
      if (!wDobRes.valid) fieldErrors['wife.dob'] = wDobRes.error;

      if (Object.keys(fieldErrors).length > 0) {
        return res.status(400).json({ error: 'Validation failed for submitted fields', fieldErrors });
      }

      // Reformat normalized values
      payload.surname_name = surRes.value;
      husband.first_name = hFirstRes.value;
      husband.middle_name = hMidRes.value;
      husband.last_name = hLastRes.value;
      husband.full_name = composeFullName(hFirstRes.value, hMidRes.value, hLastRes.value);
      husband.email = hEmailRes.value;
      husband.phone = hPhoneRes.value;
      husband.dob = hDobRes.value;

      wife.first_name = wFirstRes.value;
      wife.middle_name = wMidRes.value;
      wife.last_name = wLastRes.value;
      wife.full_name = composeFullName(wFirstRes.value, wMidRes.value, wLastRes.value);
      wife.email = wEmailRes.value;
      wife.phone = wPhoneRes.value;
      wife.dob = wDobRes.value;

      // Husband duplicates check
      const dupH = checkDuplicates(husband, existingPersons, pendingRequests);
      if (dupH.blocked) return res.status(409).json({ error: dupH.reason });
      flags.push(...dupH.flags);

      // Wife duplicates check
      const dupW = checkDuplicates(wife, existingPersons, pendingRequests);
      if (dupW.blocked) return res.status(409).json({ error: dupW.reason });
      flags.push(...dupW.flags);

      // Check existing approved families sharing the same surname
      const normSurname = normalizeSurnameLetters(surRes.value);
      const existingSameNormSurnames = allSurnames.filter(s =>
        s.status === 'Approved' &&
        (s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name)) === normSurname
      );

      payload.existing_families_count = existingSameNormSurnames.length;
      payload.existing_family_ref_ids = existingSameNormSurnames.map(s => s.surname_ref_id);

      if (existingSameNormSurnames.length > 0 && !payload.different_family_confirmed) {
        return res.status(400).json({
          error: `Families with surname "${surRes.value}" already exist. Confirmation that this is a different family branch is required before submission.`
        });
      }
    }

    // ---------------------------------------------------------
    // 2. ADD_MEMBER
    // ---------------------------------------------------------
    else if (type === 'ADD_MEMBER') {
      const person = payload.person || payload;
      const pFirstRes = validateName(person.first_name, true);
      if (!pFirstRes.valid) fieldErrors['first_name'] = pFirstRes.error;
      const pMidRes = validateName(person.middle_name, false);
      if (!pMidRes.valid) fieldErrors['middle_name'] = pMidRes.error;
      const pLastRes = validateName(person.last_name, true);
      if (!pLastRes.valid) fieldErrors['last_name'] = pLastRes.error;

      const pDobRes = parseAndValidateDob(person.dob);
      if (!pDobRes.valid) fieldErrors['dob'] = pDobRes.error;

      const isAdultAndAlive = !person.is_deceased && pDobRes.valid && pDobRes.age >= 18;
      const pEmailRes = validateEmail(person.email, isAdultAndAlive);
      if (!pEmailRes.valid) fieldErrors['email'] = pEmailRes.error;

      const pPhoneRes = validatePhone(person.phone, isAdultAndAlive);
      if (!pPhoneRes.valid) fieldErrors['phone'] = pPhoneRes.error;

      // Submitter contact validation
      if (payload.submitter_name) {
        const subNameRes = validateName(payload.submitter_name, true);
        if (!subNameRes.valid) fieldErrors['submitter_name'] = subNameRes.error;
      }
      if (payload.submitter_email) {
        const subEmailRes = validateEmail(payload.submitter_email, true);
        if (!subEmailRes.valid) fieldErrors['submitter_email'] = subEmailRes.error;
      }
      if (payload.submitter_phone) {
        const subPhoneRes = validatePhone(payload.submitter_phone, true);
        if (!subPhoneRes.valid) fieldErrors['submitter_phone'] = subPhoneRes.error;
      }

      if (Object.keys(fieldErrors).length > 0) {
        return res.status(400).json({ error: 'Validation failed for submitted fields', fieldErrors });
      }

      person.first_name = pFirstRes.value;
      person.middle_name = pMidRes.value;
      person.last_name = pLastRes.value;
      person.full_name = composeFullName(pFirstRes.value, pMidRes.value, pLastRes.value);
      person.dob = pDobRes.value;
      person.email = pEmailRes.value;
      person.phone = pPhoneRes.value;

      const dupP = checkDuplicates(person, existingPersons, pendingRequests);
      if (dupP.blocked) return res.status(409).json({ error: dupP.reason });
      flags.push(...dupP.flags);

      // A4 Warning: Check exact Name + DOB within selected family branch
      const familyPersons = existingPersons.filter(p => p.surname_ref_id === payload.surname_ref_id);
      const a4 = checkA4FamilyMatch(person, familyPersons);
      if (a4.warning && !payload.proceed_anyway) {
        return res.status(200).json({
          warning: true,
          code: 'A4_FAMILY_MATCH',
          message: a4.message,
          matched_member: a4.matched_member
        });
      }
    }

    // ---------------------------------------------------------
    // 2.5. JOIN_REQUEST (PRD v4.0)
    // ---------------------------------------------------------
    else if (type === 'JOIN_REQUEST') {
      const person = payload.person || payload;
      const relPersonId = payload.relative_person_id;
      const relType = payload.relationship || payload.relationship_type;

      if (!relPersonId) {
        return res.status(400).json({ error: 'Please select a relative from the family tree.' });
      }
      const relative = existingPersons.find(p => p.person_id === relPersonId || p.member_ref_id === relPersonId);
      if (!relative) {
        return res.status(404).json({ error: 'Selected relative not found in the portal.' });
      }

      const pFirstRes = validateName(person.first_name, true);
      if (!pFirstRes.valid) fieldErrors['first_name'] = pFirstRes.error;
      const pMidRes = validateName(person.middle_name, false);
      if (!pMidRes.valid) fieldErrors['middle_name'] = pMidRes.error;
      const pLastRes = validateName(person.last_name, true);
      if (!pLastRes.valid) fieldErrors['last_name'] = pLastRes.error;

      const pDobRes = parseAndValidateDob(person.dob);
      if (!pDobRes.valid) fieldErrors['dob'] = pDobRes.error;

      const pEmailRes = validateEmail(person.email, true);
      if (!pEmailRes.valid) fieldErrors['email'] = pEmailRes.error;

      const pPhoneRes = validatePhone(person.phone, true);
      if (!pPhoneRes.valid) fieldErrors['phone'] = pPhoneRes.error;

      if (Object.keys(fieldErrors).length > 0) {
        return res.status(400).json({ error: 'Validation failed for submitted fields', fieldErrors });
      }

      person.first_name = pFirstRes.value;
      person.middle_name = pMidRes.value;
      person.last_name = pLastRes.value;
      person.full_name = composeFullName(pFirstRes.value, pMidRes.value, pLastRes.value);
      person.dob = pDobRes.value;
      person.email = pEmailRes.value;
      person.phone = pPhoneRes.value;

      const dupJ = checkDuplicates(person, existingPersons, pendingRequests);
      if (dupJ.blocked) return res.status(409).json({ error: dupJ.reason });
      flags.push(...dupJ.flags);

      // A4 Warning in relative's family
      const famPersons = existingPersons.filter(p => p.surname_ref_id === relative.surname_ref_id);
      const a4J = checkA4FamilyMatch(person, famPersons);
      if (a4J.warning && !payload.proceed_anyway) {
        return res.status(200).json({
          warning: true,
          code: 'A4_FAMILY_MATCH',
          message: a4J.message,
          matched_member: a4J.matched_member
        });
      }

      payload.surname_ref_id = relative.surname_ref_id;
      payload.relative_name = relative.full_name || relative.display_name;
    }

    // ---------------------------------------------------------
    // 3. LINK_FAMILIES / MERGE_FAMILIES
    // ---------------------------------------------------------
    else if (type === 'LINK_FAMILIES' || type === 'MERGE_FAMILIES') {
      const link_type = (payload.link_type || (type === 'MERGE_FAMILIES' ? 'MERGE_FAMILIES' : '')).toUpperCase();
      const famA = (payload.family_a_ref_id || '').toUpperCase().trim();
      const famB = (payload.family_b_ref_id || '').toUpperCase().trim();

      if (!famA || !famB) {
        return res.status(400).json({ error: 'Both Family A and Family B references are required' });
      }
      if (famA === famB) {
        return res.status(400).json({ error: 'Cannot link or merge a family with itself' });
      }

      // Verify both families exist
      const rowA = allSurnames.find(s => s.surname_ref_id === famA);
      const rowB = allSurnames.find(s => s.surname_ref_id === famB);
      if (!rowA || !rowB) {
        return res.status(404).json({ error: 'One or both specified families do not exist' });
      }

      // MERGE_FAMILIES is ONLY allowed for same surname
      if (link_type === 'MERGE_FAMILIES') {
        const normA = rowA.surname_norm ? normalizeSurnameLetters(rowA.surname_norm) : normalizeSurnameLetters(rowA.surname_name);
        const normB = rowB.surname_norm ? normalizeSurnameLetters(rowB.surname_norm) : normalizeSurnameLetters(rowB.surname_name);
        if (normA !== normB) {
          return res.status(400).json({ error: 'MERGE_FAMILIES is only allowed between families with the same surname' });
        }
      }

      // For SAME_PERSON and PARENT_CHILD, person IDs must be provided
      if (link_type === 'SAME_PERSON' || link_type === 'PARENT_CHILD') {
        if (!payload.person_a_id || !payload.person_b_id) {
          return res.status(400).json({ error: `Selected persons from both Family ${famA} and Family ${famB} are required for ${link_type}` });
        }
      }

      // Validate both parties' registered emails (typed in by user)
      const partyAEmail = payload.party_a_email || requester_email || payload.requester_email || '';
      const partyBEmail = payload.party_b_email || payload.second_party_email || '';

      const valA = validateEmail(partyAEmail, true);
      if (!valA.valid) {
        return res.status(400).json({ error: `Family A registered email is invalid: ${valA.error}` });
      }
      const valB = validateEmail(partyBEmail, true);
      if (!valB.valid) {
        return res.status(400).json({ error: `Family B registered email is invalid: ${valB.error}` });
      }

      payload.party_a_email = valA.value;
      payload.party_b_email = valB.value;
    }

    // ---------------------------------------------------------
    // 4. DELINK_FAMILIES
    // ---------------------------------------------------------
    else if (type === 'DELINK_FAMILIES') {
      const famA = (payload.family_a_ref_id || '').toUpperCase().trim();
      const famB = (payload.family_b_ref_id || '').toUpperCase().trim();
      const reqEmail = normalizeEmail(requester_email || payload.requester_email || '');

      if (!famA || !famB) {
        return res.status(400).json({ error: 'Both linked family references are required for delinking' });
      }

      const valEmail = validateEmail(reqEmail, true);
      if (!valEmail.valid) {
        return res.status(400).json({ error: 'Valid registered email of a family member is required to request delink' });
      }

      // Verify requester belongs to either founding family
      const memberInFam = existingPersons.find(p =>
        (p.surname_ref_id === famA || p.surname_ref_id === famB) &&
        normalizeEmail(p.email) === valEmail.value &&
        p.status === 'Approved'
      );

      if (!memberInFam) {
        return res.status(403).json({ error: 'Delink request must be submitted with a registered email belonging to either family' });
      }
    }

    // Format Ticket ID
    const ticketPrefix =
      type === 'ONBOARD_SURNAME' ? 'TKT-SRN' :
      type === 'JOIN_REQUEST' ? 'TKT-JON' :
      type === 'ADD_MEMBER' ? 'TKT-MEM' :
      type === 'MERGE_FAMILIES' ? 'TKT-MRG' :
      type === 'DELINK_FAMILIES' ? 'TKT-DLK' : 'TKT-LNK';

    const ticketId = `${ticketPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    if (flags.length > 0) payload.duplicate_flags = flags;

    const finalRequesterEmail = requester_email || payload.requester_email || payload.party_a_email || payload.person?.email || '';
    const secondPartyEmail = payload.party_b_email || payload.second_party_email || '';

    // Check if OTP was verified for requester or parties
    let isMailVerified = false;
    let mailVerifiedNote = '';

    const reqToken = payload.otp_token || payload.requester_otp_token || req.body.otp_token;
    if (reqToken && finalRequesterEmail) {
      const chk = verifyVerificationToken(reqToken, type, finalRequesterEmail);
      if (chk.valid) {
        isMailVerified = true;
        mailVerifiedNote = 'Verified by OTP at submission';
      }
    }

    await sheetsClient.appendRow(TABS.REQUESTS, {
      ticket_id: ticketId,
      type,
      payload_json: JSON.stringify(payload),
      requester_email: finalRequesterEmail,
      status: 'Pending',
      mail_verified: isMailVerified ? 'true' : 'false',
      mail_verified_note: mailVerifiedNote,
      second_party_email: secondPartyEmail,
      second_party_mail_verified: 'false',
      second_party_mail_note: '',
      created_at: now
    });

    // Send confirmation email
    if (finalRequesterEmail) {
      try {
        await sendTicketReceivedEmail({
          toEmail: finalRequesterEmail,
          fullName: payload.submitter_name || payload.person?.full_name || payload.husband?.full_name || '',
          ticketId,
          requestType: type
        });
      } catch (mailErr) {
        console.warn('[Requests] Ticket confirmation email note:', mailErr.message);
      }
    }

    await logAuditEvent(sheetsClient, {
      admin: 'SYSTEM_PUBLIC_REQUEST',
      action: `CREATE_${type}_REQUEST`,
      entity: 'Requests',
      entity_id: ticketId,
      previous_value: null,
      updated_value: { ticket_id: ticketId, type, requester_email: finalRequesterEmail },
      ticket_id: ticketId
    });

    res.status(201).json({
      success: true,
      ticket_id: ticketId,
      status: 'Pending',
      message: 'Request submitted successfully. To verify identity, email support with Ticket ID in subject.',
      duplicate_flags_detected: flags.length > 0 ? flags : undefined,
      verification_instructions: {
        support_email: process.env.SUPPORT_EMAIL || 'support.familytree@gmail.com',
        subject: `Ticket #${ticketId} - Verification`,
        note: (type === 'LINK_FAMILIES' || type === 'MERGE_FAMILIES')
          ? 'Both parties must send an email to support from their registered email addresses quoting this ticket.'
          : 'Please send an email from your registered email address quoting this ticket.'
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

