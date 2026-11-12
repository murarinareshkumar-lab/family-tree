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
        marital_status: p.marital_status || (p.founding_role === 'WIFE' || p.founding_role === 'HUSBAND' || spouseName ? 'Married' : ''),
        surname_before_marriage: p.surname_before_marriage || p.maiden_surname || '',
        has_registered_email: Boolean(p.email && p.email.trim()),
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

/**
 * POST /api/families/verify-member-email
 * Validates that the entered email matches the selected family member's registered email.
 * Body: { person_id, email }
 */
router.post('/verify-member-email', async (req, res, next) => {
  const { person_id, email } = req.body || {};
  if (!person_id) {
    return res.status(400).json({ ok: false, error: 'Please select a family member first.' });
  }

  try {
    const sheetsClient = getSheetsClient();
    const persons = await sheetsClient.getRows(TABS.PERSONS);
    const target = persons.find(
      p => (p.person_id === person_id || p.member_ref_id === person_id) && p.status === 'Approved'
    );

    if (!target) {
      return res.status(404).json({ ok: false, error: 'Selected family member not found in records.' });
    }

    // If member has no registered email (e.g. deceased or elder added without email)
    if (!target.email || !target.email.trim()) {
      return res.json({
        ok: true,
        verified: false,
        direct_link_eligible: false,
        has_registered_email: false,
        member_name: target.full_name,
        message: 'This family member has no email registered (deceased or elder record). You can send an exception request for administrator review.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        ok: false,
        verified: false,
        direct_link_eligible: false,
        error: `Please enter the registered email address for ${target.full_name}.`
      });
    }

    const normTargetEmail = String(target.email).trim().toLowerCase();
    const normEnteredEmail = String(email).trim().toLowerCase();

    if (normTargetEmail === normEnteredEmail) {
      return res.json({
        ok: true,
        verified: true,
        direct_link_eligible: true,
        has_registered_email: true,
        member_name: target.full_name,
        message: `Verified! Email matches records for ${target.full_name}. You can link directly to this family.`
      });
    } else {
      return res.status(400).json({
        ok: false,
        verified: false,
        direct_link_eligible: false,
        has_registered_email: true,
        error: `The email entered does not match the registered email for ${target.full_name}. Please check with your family member or send an exception request to the administrator.`
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
