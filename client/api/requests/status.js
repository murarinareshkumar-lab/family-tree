import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  if (!applyRateLimit(req, res, 60)) return;
  const query = parseQuery(req);
  const ticketId = (query.ticket_id || '').trim().toUpperCase();
  if (!ticketId) return sendError(res, 400, 'ticket_id is required');

  try {
    const sheetsClient = getSheetsClient();
    const rows = await sheetsClient.getRows(TABS.REQUESTS);
    const t = rows.find(r => r.ticket_id === ticketId);
    if (!t) return sendError(res, 404, `Ticket #${ticketId} not found`);

    sendJson(res, 200, {
      ticket_id: t.ticket_id,
      type: t.type,
      status: t.status,
      mail_verified: String(t.mail_verified).toLowerCase() === 'true',
      created_at: t.created_at,
      decided_at: t.decided_at || null,
      admin_remarks: t.admin_remarks || null,
      verification_instructions: {
        support_email: process.env.SUPPORT_EMAIL || 'support@familytree.org',
        subject: `Ticket #${t.ticket_id} - Verification`
      }
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch ticket status', err.message);
  }
}
