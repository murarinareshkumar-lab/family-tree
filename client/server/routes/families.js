import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';

const router = express.Router();

// GET /api/families/members?ref=...
router.get('/members', async (req, res, next) => {
  const ref = String(req.query.ref || req.query.surname_ref_id || '').trim().toUpperCase();
  if (!ref) {
    return res.status(400).json({ error: 'Query parameter "ref" (surname_ref_id) is required' });
  }

  try {
    const sheetsClient = getSheetsClient();
    const persons = await sheetsClient.getRows(TABS.PERSONS);

    const familyPersons = persons.filter(
      p => p.surname_ref_id?.toUpperCase() === ref && p.status === 'Approved'
    );

    const members = familyPersons.map(p => ({
      name: p.full_name || '',
      member_ref_id: p.member_ref_id || '',
      person_id: p.person_id || '',
      founding_role: p.founding_role || ''
    }));

    res.json({ ok: true, surname_ref_id: ref, members });
  } catch (err) {
    next(err);
  }
});

export default router;
