import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { sendJson, sendError, applyRateLimit } from '../lib/api-helper.js';

export default async function handler(req, res) {
  if (!applyRateLimit(req, res, 60)) return;
  try {
    const sheetsClient = getSheetsClient();
    const rows = await sheetsClient.getRows(TABS.SURNAMES);
    const approvedSurnames = rows
      .filter(r => r.status === 'Approved')
      .map(r => ({
        surname_ref_id: r.surname_ref_id,
        surname_name: r.surname_name,
        created_at: r.created_at
      }));
    sendJson(res, 200, { surnames: approvedSurnames });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch surnames', err.message);
  }
}
