import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { normalizeSurnameLetters } from '../../lib/id-generator.js';

const router = express.Router();

/**
 * Searches approved families sharing a surname.
 * Strict privacy: names only. No member_ref_id, no surname_ref_id, no dates, no contact details.
 */
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

  // 3. For each approved family, return founding couple names only
  const families = [];
  for (let idx = 0; idx < approvedMatchingSurnames.length; idx++) {
    const s = approvedMatchingSurnames[idx];
    const familyPersons = persons.filter(
      p => p.surname_ref_id === s.surname_ref_id && p.status === 'Approved'
    );

    let husband = familyPersons.find(
      p => String(p.founding_role).toUpperCase() === 'HUSBAND' || String(p.member_ref_id).endsWith('-0001') || String(p.member_ref_id).endsWith('-1')
    );
    let wife = familyPersons.find(
      p => String(p.founding_role).toUpperCase() === 'WIFE' || String(p.member_ref_id).endsWith('-0002') || String(p.member_ref_id).endsWith('-2')
    );

    const branchNo = parseInt(s.branch_no, 10) || (idx + 1);

    // Strict whitelist: branch_no, husband name, wife name
    families.push({
      branch_no: branchNo,
      husband: husband ? { name: husband.full_name || '' } : null,
      wife: wife ? { name: wife.full_name || '' } : null
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

// GET /api/surnames/search?q=...
router.get('/search', async (req, res, next) => {
  const q = String(req.query.q || req.query.search || '').trim();
  if (q.length < 3) {
    return res.status(400).json({ error: 'Minimum 3 characters required to search surnames' });
  }

  try {
    const sheetsClient = getSheetsClient();
    const result = await performSurnameSearch(q, sheetsClient);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/surnames
router.get('/', async (req, res, next) => {
  const q = String(req.query.q || req.query.search || '').trim();
  if (q) {
    if (q.length < 3) {
      return res.status(400).json({ error: 'Minimum 3 characters required to search surnames' });
    }
    try {
      const sheetsClient = getSheetsClient();
      const result = await performSurnameSearch(q, sheetsClient);
      if (result.error) return res.status(400).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }

  try {
    const sheetsClient = getSheetsClient();
    const [rows, persons, familyLinks] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.FAMILY_LINKS)
    ]);
    const approvedSurnames = rows
      .filter(r => r.status === 'Approved')
      .map(r => {
        const familyPersons = persons.filter(p => p.surname_ref_id === r.surname_ref_id && p.status === 'Approved');
        const husband = familyPersons.find(p => String(p.founding_role).toUpperCase() === 'HUSBAND' || String(p.member_ref_id).endsWith('-0001'));
        const wife = familyPersons.find(p => String(p.founding_role).toUpperCase() === 'WIFE' || String(p.member_ref_id).endsWith('-0002'));
        const linked = familyLinks.filter(l => l.status === 'Approved' && (l.family_a_ref_id === r.surname_ref_id || l.family_b_ref_id === r.surname_ref_id));
        return {
          surname_ref_id: r.surname_ref_id,
          surname_name: r.surname_name,
          surname_norm: r.surname_norm,
          branch_no: r.branch_no || '1',
          member_count: familyPersons.length,
          founding_husband: husband ? (husband.full_name || `${husband.first_name || ''} ${husband.last_name || ''}`.trim()) : '',
          founding_wife: wife ? (wife.full_name || `${wife.first_name || ''} ${wife.last_name || ''}`.trim()) : '',
          linked_families_count: linked.length
        };
      });
    res.json({ surnames: approvedSurnames });
  } catch (err) {
    next(err);
  }
});

export default router;
