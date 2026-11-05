import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { normalizeUnicode, whitelistPublicSearchResult } from '../../lib/security.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../../lib/api-helper.js';

export function normalizeForSearch(raw) {
  if (!raw) return '';
  const norm = normalizeUnicode(raw).toUpperCase();
  return norm.replace(/[^\p{L}\p{M}]/gu, '');
}

export async function performSurnameSearch(q, sheetsClient) {
  const normQ = normalizeForSearch(q);
  if (!normQ) return { error: 'Search term must contain letters' };

  const [surnames, persons, relationships, requests] = await Promise.all([
    sheetsClient.getRows(TABS.SURNAMES),
    sheetsClient.getRows(TABS.PERSONS),
    sheetsClient.getRows(TABS.RELATIONSHIPS),
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

  if (matchingSurnameIds.size === 0) {
    return {
      query: q,
      count: 0,
      results: [],
      has_pending_request: hasPendingRequest,
      pending_message: hasPendingRequest ? 'A request for this surname is awaiting approval' : null
    };
  }

  // 3. Find Approved members for matching surnames
  const approvedPersons = persons.filter(
    p => matchingSurnameIds.has(p.surname_ref_id) && p.status === 'Approved'
  );

  const approvedRels = relationships.filter(r => r.status === 'Approved');

  // Map parents from relationships
  const childSet = new Set(
    approvedRels
      .filter(r => r.type === 'PARENT_OF')
      .map(r => r.person_b_id)
  );

  // Derive roles
  const classifiedMembers = approvedPersons.map(p => {
    const isRoot = !childSet.has(p.person_id);
    const gender = (p.gender || '').toUpperCase();
    const refId = String(p.member_ref_id || '');

    let role = 'Member';
    let sortPriority = 2;

    if (refId.endsWith('-0001') || refId.endsWith('-1') || (isRoot && gender === 'MALE')) {
      role = 'Founding husband';
      sortPriority = 0;
    } else if (refId.endsWith('-0002') || refId.endsWith('-2') || (isRoot && gender === 'FEMALE')) {
      role = 'Founding wife';
      sortPriority = 1;
    }

    return {
      ...whitelistPublicSearchResult(p, role),
      sortPriority
    };
  });

  // Sort: Founding husband first (0), Founding wife second (1), then other members (2)
  classifiedMembers.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) {
      return a.sortPriority - b.sortPriority;
    }
    return String(a.member_ref_id).localeCompare(String(b.member_ref_id));
  });

  // Clean sortPriority from public response
  const results = classifiedMembers.map(({ display_name, member_ref_id, role }) => ({
    display_name,
    member_ref_id,
    role
  })).slice(0, 20); // Cap at 20

  return {
    query: q,
    count: results.length,
    results,
    has_pending_request: hasPendingRequest,
    pending_message: hasPendingRequest ? 'A request for this surname is awaiting approval' : null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed. Use GET.');
  if (!applyRateLimit(req, res, 60)) return;

  const queryParams = parseQuery(req);
  const q = String(queryParams.q || queryParams.search || '').trim();

  if (q.length < 3) {
    return sendError(res, 400, 'Minimum 3 characters required to search surnames');
  }

  try {
    const sheetsClient = getSheetsClient();
    const result = await performSurnameSearch(q, sheetsClient);
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    sendJson(res, 200, result);
  } catch (err) {
    sendError(res, 500, 'Failed to perform surname search', err.message);
  }
}
