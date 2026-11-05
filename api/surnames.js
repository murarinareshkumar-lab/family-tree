import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../lib/api-helper.js';
import { performSurnameSearch } from './surnames/search.js';

export default async function handler(req, res) {
  if (!applyRateLimit(req, res, 60)) return;

  const queryParams = parseQuery(req);
  const q = String(queryParams.q || queryParams.search || '').trim();

  // If search query or search subpath was routed here
  if (q || (req.url && req.url.includes('/search'))) {
    if (q.length < 3) {
      return sendError(res, 400, 'Minimum 3 characters required to search surnames');
    }
    try {
      const sheetsClient = getSheetsClient();
      const result = await performSurnameSearch(q, sheetsClient);
      if (result.error) return sendError(res, 400, result.error);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, 'Failed to perform surname search', err.message);
    }
  }

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
