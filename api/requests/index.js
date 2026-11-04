import { randomUUID } from 'node:crypto';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { checkDuplicates, normalizeEmail, normalizePhone, isMinor } from '../../lib/duplicates.js';
import { validateRelationship } from '../../lib/relationships.js';
import { logAuditEvent } from '../../lib/audit.js';
import { sendOnboardingConfirmationEmail } from '../../lib/email.js';
import { sendJson, sendError, parseBody, applyRateLimit } from '../../lib/api-helper.js';

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

    if (type === 'ONBOARD_SURNAME') {
      const { surname, husband, wife } = payload;
      if (!surname || !husband?.full_name || !wife?.full_name) return sendError(res, 400, 'Surname, Husband, and Wife details required');
      if (!husband.email || !husband.phone || !wife.email || !wife.phone) return sendError(res, 400, 'Adults must provide both email and phone number');

      const dupH = checkDuplicates(husband, existingPersons, pendingRequests);
      if (dupH.blocked) return sendError(res, 409, dupH.reason);
      flags.push(...dupH.flags);

      const dupW = checkDuplicates(wife, existingPersons, pendingRequests);
      if (dupW.blocked) return sendError(res, 409, dupW.reason);
      flags.push(...dupW.flags);
    } else if (type === 'ADD_MEMBER') {
      const { surname_ref_id, person, relative_person_id, relationship_type } = payload;
      if (!surname_ref_id || !person?.full_name || !relationship_type || !relative_person_id) {
        return sendError(res, 400, 'Missing member details');
      }
      const dupP = checkDuplicates(person, existingPersons, pendingRequests);
      if (dupP.blocked) return sendError(res, 409, dupP.reason);
      flags.push(...dupP.flags);
    }

    const ticketId = `TKT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const row = {
      ticket_id: ticketId,
      type,
      payload_json: JSON.stringify({ ...payload, duplicate_flags: flags }),
      requester_email: normalizeEmail(requester_email || payload.requester_email || payload.husband?.email || payload.person?.email || ''),
      status: 'Pending',
      mail_verified: 'false',
      mail_verified_note: '',
      created_at: now,
      decided_at: '',
      admin_remarks: ''
    };

    await sheetsClient.appendRow(TABS.REQUESTS, row);
    await logAuditEvent(sheetsClient, {
      admin: 'public_user', action: `REQUEST_SUBMITTED_${type}`, entity: 'Requests', entity_id: ticketId, updated_value: row, ticket_id: ticketId
    });

    sendJson(res, 201, {
      success: true,
      ticket_id: ticketId,
      status: 'Pending',
      message: 'Request submitted successfully. To verify identity, email support with Ticket ID in subject.',
      duplicate_flags_detected: flags.length > 0 ? flags : undefined,
      verification_instructions: { support_email: process.env.SUPPORT_EMAIL || 'support@familytree.org', subject: `Ticket #${ticketId} - Verification` }
    });
  } catch (err) {
    sendError(res, 500, 'Failed to submit request', err.message);
  }
}
