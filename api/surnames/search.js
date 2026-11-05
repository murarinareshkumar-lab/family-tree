import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { normalizeUnicode, whitelistPublicSearchResult } from '../../lib/security.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../../lib/api-helper.js';

function normalizeForSearch(raw) {
  if (!raw) return '';
  const norm = normalizeUnicode(raw).toUpperCase();
  // Keep letters (supporting Unicode letters across scripts)
  return norm.replace(/[^\p{L}]/gu, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed. Use GET.');
  if (!applyRateLimit(req, res, 60)) return;

  const queryParams = parseQuery(req);
  const q = String(queryParams.q || '').trim();

  if (q.length < 3) {
    return sendError(res, 400, 'Minimum 3 characters required to search surnames');
  }

  const normQ = normalizeForSearch(q);
  if (!normQ) {
    return sendError(res, 400, 'Search term must contain at least 3 letters');
  }

  try {
    const sheetsClient = getSheetsClient();
    const [surnames, persons, requests] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.REQUESTS)
    ]);

    // 1. Check if a request for the same surname is currently Pending
    let hasPendingRequest = false;
    for (const reqRow of requests) {
      if (reqRow.status === 'Pending' && reqRow.type === 'ONBOARD_SURNAME') {
        let payload = {};
        try {
          payload = typeof reqRow.payload_json === 'string' ? JSON.parse(reqRow.payload_json) : reqRow.payload_json;
        } catch (_) {}
        const pendingSurname = payload.surname || payload.surname_name || '';
        if (normalizeForSearch(pendingSurname) === normQ) {
          hasPendingRequest = true;
          break;
        }
      }
    }

    // 2. Find Approved matching surnames
    const matchingSurnameIds = new Set();
    for (const s of surnames) {
      if (s.status === 'Approved') {
        const normSurname = normalizeForSearch(s.surname_name);
        if (normSurname.includes(normQ) || normQ.includes(normSurname)) {
          matchingSurnameIds.add(s.surname_ref_id);
        }
      }
    }

    // 3. Find Approved members for matching surnames
    const results = [];
    if (matchingSurnameIds.size > 0) {
      for (const p of persons) {
        if (matchingSurnameIds.has(p.surname_ref_id) && p.status === 'Approved') {
          results.push(whitelistPublicSearchResult(p));
          if (results.length >= 20) break; // Cap at 20 results
        }
      }
    }

    sendJson(res, 200, {
      query: q,
      count: results.length,
      results: results.slice(0, 20),
      has_pending_request: hasPendingRequest,
      pending_message: hasPendingRequest ? 'A request for this surname is awaiting approval' : null
    });
  } catch (err) {
    sendError(res, 500, 'Failed to perform surname search', err.message);
  }
}
