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
    const [surnames, persons, relationships] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.RELATIONSHIPS)
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

    const approvedRels = (relationships || []).filter(r => r.status === 'Approved');
    const personMap = new Map(persons.map(p => [p.person_id, p]));

    const foundingHusband = familyPersons.find(p => String(p.founding_role).toUpperCase() === 'HUSBAND');
    const foundingWife = familyPersons.find(p => String(p.founding_role).toUpperCase() === 'WIFE');

    const members = familyPersons.map(p => {
      const publicBase = whitelistPublicMember(p) || {};

      // 1. Find spouse
      let spouseName = '';
      if (p.founding_role === 'HUSBAND' && foundingWife) {
        spouseName = foundingWife.full_name || foundingWife.first_name || '';
      } else if (p.founding_role === 'WIFE' && foundingHusband) {
        spouseName = foundingHusband.full_name || foundingHusband.first_name || '';
      } else {
        const spouseRel = approvedRels.find(
          r => r.type === 'SPOUSE_OF' && (r.person_a_id === p.person_id || r.person_b_id === p.person_id)
        );
        if (spouseRel) {
          const spouseId = spouseRel.person_a_id === p.person_id ? spouseRel.person_b_id : spouseRel.person_a_id;
          const spousePerson = personMap.get(spouseId);
          if (spousePerson) {
            spouseName = spousePerson.full_name || spousePerson.first_name || '';
          }
        }
      }

      // 2. Find parents (Father / Mother)
      let fatherName = '';
      let motherName = '';
      const parentRels = approvedRels.filter(
        r => r.type === 'PARENT_OF' && r.person_b_id === p.person_id
      );

      for (const pr of parentRels) {
        const parentPerson = personMap.get(pr.person_a_id);
        if (parentPerson) {
          const pGender = String(parentPerson.gender || '').toUpperCase();
          const pName = parentPerson.full_name || parentPerson.first_name || '';
          if (pGender === 'MALE' || parentPerson.founding_role === 'HUSBAND') {
            if (!fatherName) fatherName = pName;
          } else if (pGender === 'FEMALE' || parentPerson.founding_role === 'WIFE') {
            if (!motherName) motherName = pName;
          } else {
            if (!fatherName) fatherName = pName;
          }
        }
      }

      return {
        ...publicBase,
        person_id: p.person_id,
        member_ref_id: p.member_ref_id,
        name: p.full_name || publicBase.display_name || '',
        full_name: p.full_name || publicBase.display_name || '',
        display_name: publicBase.display_name || p.full_name || '',
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        gender: p.gender || '',
        founding_role: p.founding_role || '',
        spouse_name: spouseName,
        father_name: fatherName,
        mother_name: motherName,
        parent_name: fatherName || motherName || ''
      };
    });

    res.json({ ok: true, members });
  } catch (err) {
    next(err);
  }
});

export default router;
