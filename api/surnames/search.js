import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { normalizeSurnameLetters } from '../../lib/id-generator.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../../lib/api-helper.js';

export async function performSurnameSearch(q, sheetsClient) {
  const normQ = normalizeSurnameLetters(q);
  if (!normQ || normQ.length < 3) {
    return { error: 'Search term must contain at least 3 letters' };
  }

  const [surnames, persons, requests] = await Promise.all([
    sheetsClient.getRows(TABS.SURNAMES),
    sheetsClient.getRows(TABS.PERSONS),
    sheetsClient.getRows(TABS.REQUESTS)
  ]);

  // 1. Check if an ONBOARD_SURNAME request for the same surname is pending
  let isPending = false;
  for (const reqRow of requests) {
    if (reqRow.status === 'Pending' && reqRow.type === 'ONBOARD_SURNAME') {
      let payload = {};
      try {
        payload = typeof reqRow.payload_json === 'string' ? JSON.parse(reqRow.payload_json) : reqRow.payload_json;
      } catch (_) {}
      const pendingSurname = payload.surname || payload.surname_name || '';
      if (normalizeSurnameLetters(pendingSurname) === normQ) {
        isPending = true;
        break;
      }
    }
  }

  // 2. Find Approved matching surnames (exact match on normalized letters, Merged excluded)
  const approvedMatchingSurnames = [];
  for (const s of surnames) {
    if (s.status === 'Approved') {
      const sNorm = s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name);
      if (sNorm === normQ) {
        approvedMatchingSurnames.push(s);
      }
    }
  }

  // 3. For each approved family, find founding husband and wife only
  const families = [];
  for (let idx = 0; idx < approvedMatchingSurnames.length; idx++) {
    const s = approvedMatchingSurnames[idx];
    const familyPersons = persons.filter(
      p => p.surname_ref_id === s.surname_ref_id && p.status === 'Approved'
    );

    // Look by founding_role (HUSBAND / WIFE) with fallback to member number -0001 and -0002
    let husband = familyPersons.find(
      p => String(p.founding_role).toUpperCase() === 'HUSBAND' || String(p.member_ref_id).endsWith('-0001') || String(p.member_ref_id).endsWith('-1')
    );
    let wife = familyPersons.find(
      p => String(p.founding_role).toUpperCase() === 'WIFE' || String(p.member_ref_id).endsWith('-0002') || String(p.member_ref_id).endsWith('-2')
    );

    const branchNo = parseInt(s.branch_no, 10) || (idx + 1);

    // Strict whitelist: branch_no, surname_ref_id, husband, wife
    families.push({
      branch_no: branchNo,
      surname_ref_id: s.surname_ref_id,
      husband: husband ? { name: husband.full_name || '', member_ref_id: husband.member_ref_id || '' } : null,
      wife: wife ? { name: wife.full_name || '', member_ref_id: wife.member_ref_id || '' } : null
    });
  }

  // Sort by branch_no ascending, cap at max 10
  families.sort((a, b) => a.branch_no - b.branch_no);
  const cappedFamilies = families.slice(0, 10);

  return {
    ok: true,
    query: q,
    found: cappedFamilies.length > 0,
    pending: isPending,
    families: cappedFamilies
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
