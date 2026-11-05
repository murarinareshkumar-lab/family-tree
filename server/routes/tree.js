import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { whitelistPublicMember } from '../../lib/security.js';
import { computeRelationshipLabel } from '../../lib/relationships.js';

const router = express.Router();

// GET /api/tree?surname_ref_id=...&show_connected=...
router.get('/', async (req, res, next) => {
  const surnameRefId = (req.query.surname || req.query.surname_ref_id || req.query.ref || '').toUpperCase().trim();
  if (!surnameRefId) {
    return res.status(400).json({ error: 'Query parameter "ref" or "surname_ref_id" is required' });
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

    const surnameRow = allSurnames.find(s => s.surname_ref_id === surnameRefId && s.status === 'Approved');
    if (!surnameRow) {
      return res.status(404).json({ error: `Family "${surnameRefId}" not found or not approved` });
    }

    const familyPersons = allPersons.filter(p => p.surname_ref_id === surnameRefId && p.status === 'Approved');
    const personMap = new Map(familyPersons.map(p => [p.person_id, p]));
    const approvedRels = allRelationships.filter(r => r.status === 'Approved');

    // Find connected links for this family
    const approvedLinks = allFamilyLinks.filter(l =>
      l.status === 'Approved' && (l.family_a_ref_id === surnameRefId || l.family_b_ref_id === surnameRefId)
    );

    const connectedFamilies = approvedLinks.map(l => {
      const otherRef = l.family_a_ref_id === surnameRefId ? l.family_b_ref_id : l.family_a_ref_id;
      const otherFam = allSurnames.find(s => s.surname_ref_id === otherRef) || {};
      const branchNo = otherFam.branch_no || '1';
      const surnameName = otherFam.surname_name || 'Family';
      return {
        link_id: l.link_id,
        link_type: l.link_type,
        connected_family_ref_id: otherRef,
        connected_surname_name: surnameName,
        connected_branch_no: branchNo,
        person_a_id: l.person_a_id,
        person_b_id: l.person_b_id,
        badge: `Connected: Family ${branchNo} (${surnameName})`
      };
    });

    const publicMembers = familyPersons.map(p => {
      const whitelisted = whitelistPublicMember(p);
      const directRels = approvedRels.filter(r => r.person_a_id === p.person_id || r.person_b_id === p.person_id).map(r => {
        const relativeId = r.person_a_id === p.person_id ? r.person_b_id : r.person_a_id;
        const relative = personMap.get(relativeId);
        return {
          relative_id: relativeId,
          relative_ref_id: relative?.member_ref_id || '',
          relative_name: relative?.full_name || '',
          relationship: computeRelationshipLabel(p.person_id, relativeId, approvedRels, personMap)
        };
      });

      const personLinks = connectedFamilies.filter(c => c.person_a_id === p.person_id || c.person_b_id === p.person_id);

      return {
        ...whitelisted,
        direct_relations: directRels,
        connected_badges: personLinks.map(pl => pl.badge)
      };
    });

    // Root nodes
    const childSet = new Set(
      approvedRels
        .filter(r => r.type === 'PARENT_OF' && personMap.has(r.person_b_id) && personMap.has(r.person_a_id))
        .map(r => r.person_b_id)
    );

    let rootPersons = familyPersons.filter(p => !childSet.has(p.person_id));

    rootPersons.sort((a, b) => {
      if (a.founding_role === 'HUSBAND') return -1;
      if (b.founding_role === 'HUSBAND') return 1;
      if (a.dob && b.dob) return a.dob.localeCompare(b.dob);
      return 0;
    });

    const rootSpouseSet = new Set();
    const filteredRoots = [];
    for (const rp of rootPersons) {
      if (!rootSpouseSet.has(rp.person_id)) {
        filteredRoots.push(rp);
        const spouses = approvedRels.filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === rp.person_id).map(r => r.person_b_id);
        spouses.forEach(sId => rootSpouseSet.add(sId));
      }
    }

    function buildSubtree(personId, depth = 0, maxDepth = 4, visited = new Set()) {
      if (visited.has(personId) || depth > maxDepth) return null;
      visited.add(personId);
      const person = personMap.get(personId);
      if (!person) return null;

      const spouses = approvedRels
        .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === personId)
        .map(r => personMap.get(r.person_b_id))
        .filter(Boolean)
        .map(s => {
          const sWhitelisted = whitelistPublicMember(s);
          const sLinks = connectedFamilies.filter(c => c.person_a_id === s.person_id || c.person_b_id === s.person_id);
          return { ...sWhitelisted, connected_badges: sLinks.map(l => l.badge) };
        });

      const children = approvedRels
        .filter(r => r.type === 'PARENT_OF' && r.person_a_id === personId && personMap.has(r.person_b_id))
        .map(r => buildSubtree(r.person_b_id, depth + 1, maxDepth, new Set(visited)))
        .filter(Boolean);

      const pWhitelisted = whitelistPublicMember(person);
      const pLinks = connectedFamilies.filter(c => c.person_a_id === person.person_id || c.person_b_id === person.person_id);

      return {
        ...pWhitelisted,
        connected_badges: pLinks.map(l => l.badge),
        spouses,
        children
      };
    }

    const tree = filteredRoots.map(r => buildSubtree(r.person_id, 0, 4)).filter(Boolean);

    let connectedTrees = [];
    if (showConnected && connectedFamilies.length > 0) {
      for (const conn of connectedFamilies.slice(0, 2)) {
        const otherRef = conn.connected_family_ref_id;
        const otherPersons = allPersons.filter(p => p.surname_ref_id === otherRef && p.status === 'Approved');
        const otherPersonMap = new Map(otherPersons.map(p => [p.person_id, p]));
        const otherChildSet = new Set(
          approvedRels.filter(r => r.type === 'PARENT_OF' && otherPersonMap.has(r.person_b_id)).map(r => r.person_b_id)
        );
        const otherRoots = otherPersons.filter(p => !otherChildSet.has(p.person_id));

        function buildOtherSubtree(personId, d = 0, visited = new Set()) {
          if (visited.has(personId) || d > 2) return null;
          visited.add(personId);
          const p = otherPersonMap.get(personId);
          if (!p) return null;
          const spouses = approvedRels
            .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === personId)
            .map(r => otherPersonMap.get(r.person_b_id))
            .filter(Boolean)
            .map(s => whitelistPublicMember(s));
          const children = approvedRels
            .filter(r => r.type === 'PARENT_OF' && r.person_a_id === personId && otherPersonMap.has(r.person_b_id))
            .map(r => buildOtherSubtree(r.person_b_id, d + 1, new Set(visited)))
            .filter(Boolean);
          return { ...whitelistPublicMember(p), spouses, children };
        }

        connectedTrees.push({
          family_ref_id: otherRef,
          surname_name: conn.connected_surname_name,
          branch_no: conn.connected_branch_no,
          badge: conn.badge,
          tree: otherRoots.slice(0, 1).map(r => buildOtherSubtree(r.person_id, 0)).filter(Boolean)
        });
      }
    }

    res.json({
      surname: {
        surname_ref_id: surnameRow.surname_ref_id,
        surname_name: surnameRow.surname_name,
        branch_no: surnameRow.branch_no || '1',
        created_at: surnameRow.created_at
      },
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
