import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { whitelistPublicMember } from '../../lib/security.js';

const router = express.Router();

/**
 * GET /api/families/members?ref=... or ?surname=...
 * Strict public whitelist: display_name and throwaway node id only.
 * No member_ref_id, person_id, gender, dob, phone or email.
 */
router.get('/members', async (req, res, next) => {
  const query = String(req.query.ref || req.query.surname || req.query.surname_ref_id || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "surname" or "ref" is required' });
  }

  try {
    const sheetsClient = getSheetsClient();
    const [surnames, persons] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS)
    ]);

    const upper = query.toUpperCase();
    const targetSurname = surnames.find(s =>
      s.status === 'Approved' && (
        s.surname_ref_id?.toUpperCase() === upper ||
        s.surname_name?.toUpperCase() === upper ||
        s.surname_norm?.toUpperCase() === upper
      )
    );

    const targetRef = targetSurname ? targetSurname.surname_ref_id : query;
    const familyPersons = persons.filter(
      p => p.surname_ref_id?.toUpperCase() === targetRef.toUpperCase() && p.status === 'Approved'
    );

    const members = familyPersons.map(p => whitelistPublicMember(p));

    res.json({ ok: true, members });
  } catch (err) {
    next(err);
  }
});

export default router;
