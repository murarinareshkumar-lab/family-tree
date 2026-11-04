import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { whitelistPublicMember } from '../lib/security.js';
import { computeRelationshipLabel } from '../lib/relationships.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../lib/api-helper.js';

export default async function handler(req, res) {
  if (!applyRateLimit(req, res, 60)) return;
  const query = parseQuery(req);
  const surnameRefId = (query.surname || query.surname_ref_id || '').toUpperCase().trim();
  if (!surnameRefId) return sendError(res, 400, 'Query parameter "surname" is required');

  try {
    const sheetsClient = getSheetsClient();
    const [allSurnames, allPersons, allRelationships] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES),
      sheetsClient.getRows(TABS.PERSONS),
      sheetsClient.getRows(TABS.RELATIONSHIPS)
    ]);

    const surnameRow = allSurnames.find(s => s.surname_ref_id === surnameRefId && s.status === 'Approved');
    if (!surnameRow) return sendError(res, 404, `Surname "${surnameRefId}" not found or not approved`);

    const familyPersons = allPersons.filter(p => p.surname_ref_id === surnameRefId && p.status === 'Approved');
    const personMap = new Map(familyPersons.map(p => [p.person_id, p]));
    const approvedRels = allRelationships.filter(r => r.status === 'Approved');

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
      return { ...whitelisted, direct_relations: directRels };
    });

    const childSet = new Set(approvedRels.filter(r => r.type === 'PARENT_OF' && personMap.has(r.person_b_id)).map(r => r.person_b_id));
    const rootPersons = familyPersons.filter(p => !childSet.has(p.person_id));

    function buildSubtree(personId, visited = new Set()) {
      if (visited.has(personId)) return null;
      visited.add(personId);
      const person = personMap.get(personId);
      if (!person) return null;

      const spouses = approvedRels
        .filter(r => r.type === 'SPOUSE_OF' && r.person_a_id === personId)
        .map(r => personMap.get(r.person_b_id))
        .filter(Boolean)
        .map(s => whitelistPublicMember(s));

      const children = approvedRels
        .filter(r => r.type === 'PARENT_OF' && r.person_a_id === personId)
        .map(r => buildSubtree(r.person_b_id, new Set(visited)))
        .filter(Boolean);

      return { ...whitelistPublicMember(person), spouses, children };
    }

    const tree = rootPersons.map(r => buildSubtree(r.person_id)).filter(Boolean);
    sendJson(res, 200, {
      surname: { surname_ref_id: surnameRow.surname_ref_id, surname_name: surnameRow.surname_name, created_at: surnameRow.created_at },
      members: publicMembers,
      tree
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch family tree', err.message);
  }
}
