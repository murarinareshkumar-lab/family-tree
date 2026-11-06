import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { whitelistPublicMember, generateThrowawayId } from '../../lib/security.js';

const router = express.Router();

/**
 * GET /api/tree?surname_ref_id=...&show_connected=...
 * Returns public tree view: names and tree hierarchy only.
 * No gender, no member_ref_id, no surname_ref_id, no dates, no contact data.
 */
router.get('/', async (req, res, next) => {
  const queryRef = String(req.query.surname || req.query.surname_ref_id || req.query.ref || '').trim();
  if (!queryRef) {
    return res.status(400).json({ error: 'Query parameter "ref" or "surname" is required' });
  }

  const showConnected = String(req.query.show_connected).toLowerCase() === 'true';

  try {
    const sheetsClient = getSheetsClient();
    const [allSurnames, allPersons, allRelationships, allFamilyLinks] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.RELATIONSHIPS),
      sheetsClient.getRows(TABS.FAMILY_LINKS)
    ]);

    const upperQuery = queryRef.toUpperCase();
    const surnameRow = allSurnames.find(s =>
      s.status === 'Approved' && (
        s.surname_ref_id?.toUpperCase() === upperQuery ||
        s.surname_name?.toUpperCase() === upperQuery ||
        s.surname_norm?.toUpperCase() === upperQuery
      )
    );

    if (!surnameRow) {
      return res.status(404).json({ error: `Family "${queryRef}" not found or not approved` });
    }

    const matchedRef = surnameRow.surname_ref_id;
    const familyPersons = allPersons.filter(p => p.surname_ref_id === matchedRef && p.status === 'Approved');
    const personMap = new Map(familyPersons.map(p => [p.person_id, p]));
    const approvedRels = allRelationships.filter(r => r.status === 'Approved');

    // Create throwaway node IDs for this response
    const idMap = new Map();
    familyPersons.forEach(p => {
      idMap.set(p.person_id, generateThrowawayId());
    });

    // Whitelisted flat members list with names only
    const publicMembers = familyPersons.map(p => ({
      id: idMap.get(p.person_id),
      display_name: p.full_name || ''
    }));

    // Find connected links for this family
    const approvedLinks = allFamilyLinks.filter(l =>
      l.status === 'Approved' && (l.family_a_ref_id === matchedRef || l.family_b_ref_id === matchedRef)
    );

    const connectedFamilies = approvedLinks.map(l => {
      const otherRef = l.family_a_ref_id === matchedRef ? l.family_b_ref_id : l.family_a_ref_id;
      const otherFam = allSurnames.find(s => s.surname_ref_id === otherRef) || {};
      const branchNo = otherFam.branch_no || '1';
      const surnameName = otherFam.surname_name || 'Family';
      return {
        badge: `Connected: Family ${branchNo} (${surnameName})`
      };
    });

    // Identify root nodes: individuals with no parents in this family
    const childSet = new Set(
      approvedRels
        .filter(r => r.type === 'PARENT_OF' && personMap.has(r.person_b_id) && personMap.has(r.person_a_id))
        .map(r => r.person_b_id)
    );

    let rootPersons = familyPersons.filter(p => !childSet.has(p.person_id));

    rootPersons.sort((a, b) => {
      if (a.founding_role === 'HUSBAND') return -1;
      if (b.founding_role === 'HUSBAND') return 1;
      return 0;
    });

    const rootSpouseSet = new Set();
    const filteredRoots = [];
    for (const rp of rootPersons) {
      if (!rootSpouseSet.has(rp.person_id)) {
        filteredRoots.push(rp);
        const spouses = approvedRels
          .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === rp.person_id)
          .map(r => r.person_b_id);
        spouses.forEach(sId => rootSpouseSet.add(sId));
      }
    }

    function buildSubtree(personId, depth = 0, maxDepth = 6, visited = new Set()) {
      if (visited.has(personId) || depth > maxDepth) return null;
      visited.add(personId);
      const person = personMap.get(personId);
      if (!person) return null;

      const spouses = approvedRels
        .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === personId)
        .map(r => personMap.get(r.person_b_id))
        .filter(Boolean)
        .map(s => ({
          id: idMap.get(s.person_id) || generateThrowawayId(),
          display_name: s.full_name || ''
        }));

      const children = approvedRels
        .filter(r => r.type === 'PARENT_OF' && r.person_a_id === personId && personMap.has(r.person_b_id))
        .map(r => buildSubtree(r.person_b_id, depth + 1, maxDepth, new Set(visited)))
        .filter(Boolean);

      return {
        id: idMap.get(person.person_id) || generateThrowawayId(),
        display_name: person.full_name || '',
        spouses,
        children
      };
    }

    const tree = filteredRoots.map(r => buildSubtree(r.person_id, 0, 6)).filter(Boolean);

    let connectedTrees = [];
    if (showConnected && approvedLinks.length > 0) {
      for (const link of approvedLinks.slice(0, 2)) {
        const otherRef = link.family_a_ref_id === matchedRef ? link.family_b_ref_id : link.family_a_ref_id;
        const otherPersons = allPersons.filter(p => p.surname_ref_id === otherRef && p.status === 'Approved');
        const otherPersonMap = new Map(otherPersons.map(p => [p.person_id, p]));
        const otherChildSet = new Set(
          approvedRels.filter(r => r.type === 'PARENT_OF' && otherPersonMap.has(r.person_b_id)).map(r => r.person_b_id)
        );
        const otherRoots = otherPersons.filter(p => !otherChildSet.has(p.person_id));

        const otherIdMap = new Map();
        otherPersons.forEach(p => otherIdMap.set(p.person_id, generateThrowawayId()));

        function buildOtherSubtree(personId, d = 0, visited = new Set()) {
          if (visited.has(personId) || d > 4) return null;
          visited.add(personId);
          const p = otherPersonMap.get(personId);
          if (!p) return null;

          const spouses = approvedRels
            .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === personId)
            .map(r => otherPersonMap.get(r.person_b_id))
            .filter(Boolean)
            .map(s => ({
              id: otherIdMap.get(s.person_id) || generateThrowawayId(),
              display_name: s.full_name || ''
            }));

          const children = approvedRels
            .filter(r => r.type === 'PARENT_OF' && r.person_a_id === personId && otherPersonMap.has(r.person_b_id))
            .map(r => buildOtherSubtree(r.person_b_id, d + 1, new Set(visited)))
            .filter(Boolean);

          return {
            id: otherIdMap.get(p.person_id) || generateThrowawayId(),
            display_name: p.full_name || '',
            spouses,
            children
          };
        }

        const otherFam = allSurnames.find(s => s.surname_ref_id === otherRef) || {};
        connectedTrees.push({
          surname_name: otherFam.surname_name || 'Family',
          branch_no: otherFam.branch_no || '1',
          badge: `Connected: Family ${otherFam.branch_no || '1'} (${otherFam.surname_name || 'Family'})`,
          tree: otherRoots.slice(0, 1).map(r => buildOtherSubtree(r.person_id, 0)).filter(Boolean)
        });
      }
    }

    res.json({
      ok: true,
      surname_name: surnameRow.surname_name,
      branch_no: surnameRow.branch_no || '1',
      connected_families: connectedFamilies,
      connected_trees: showConnected ? connectedTrees : undefined,
      members: publicMembers,
      tree
    });
  } catch (err) {
    next(err);
  }
});

export default router;
