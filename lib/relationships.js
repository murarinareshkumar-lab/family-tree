export function validateRelationship({
  personAId,
  personBId,
  type,
  existingRelationships = [],
  persons = []
}) {
  if (!personAId || !personBId) return { valid: false, error: 'Both person IDs are required for a relationship' };
  if (personAId === personBId) return { valid: false, error: 'A person cannot have a relationship with themselves' };
  if (type !== 'PARENT_OF' && type !== 'SPOUSE_OF') return { valid: false, error: `Invalid relationship type: ${type}` };

  const personMap = persons instanceof Map ? persons : new Map(persons.map(p => [p.person_id, p]));
  const personA = personMap.get(personAId);
  const personB = personMap.get(personBId);

  if (type === 'PARENT_OF' && personA && personB && personA.dob && personB.dob) {
    const parentDob = new Date(personA.dob);
    const childDob = new Date(personB.dob);
    if (!isNaN(parentDob.getTime()) && !isNaN(childDob.getTime())) {
      const ageDiffMs = childDob.getTime() - parentDob.getTime();
      const min12YearsMs = 12 * 365.25 * 24 * 60 * 60 * 1000;
      if (ageDiffMs < min12YearsMs) {
        return {
          valid: false,
          error: `Impossible age gap: Parent must be at least 12 years older than child`
        };
      }
    }
  }

  if (type === 'PARENT_OF') {
    const parentGender = (personA?.gender || '').toUpperCase();
    const existingParents = existingRelationships.filter(
      r => r.person_b_id === personBId && r.type === 'PARENT_OF' && r.status !== 'Rejected'
    );
    for (const rel of existingParents) {
      if (rel.person_a_id === personAId) return { valid: true };
      const existingParent = personMap.get(rel.person_a_id);
      const existingGender = (existingParent?.gender || '').toUpperCase();
      if (parentGender && existingGender && parentGender === existingGender) {
        return {
          valid: false,
          error: `Person already has a recorded ${parentGender === 'MALE' ? 'father' : 'mother'}`
        };
      }
    }

    if (checkIsAncestor(personBId, personAId, existingRelationships)) {
      return { valid: false, error: 'Invalid relationship: Cannot add relationship because it creates a circular ancestor cycle' };
    }
  }

  return { valid: true };
}

export function checkIsAncestor(candidateAncestorId, targetPersonId, relationships = []) {
  if (candidateAncestorId === targetPersonId) return true;
  const parentsOf = new Map();
  for (const rel of relationships) {
    if (rel.type === 'PARENT_OF' && rel.status !== 'Rejected') {
      if (!parentsOf.has(rel.person_b_id)) parentsOf.set(rel.person_b_id, new Set());
      parentsOf.get(rel.person_b_id).add(rel.person_a_id);
    }
  }
  const visited = new Set();
  const queue = [targetPersonId];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === candidateAncestorId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const parents = parentsOf.get(curr);
    if (parents) {
      for (const p of parents) {
        if (!visited.has(p)) queue.push(p);
      }
    }
  }
  return false;
}

export function convertDropdownToRelationships({ newPersonId, existingPersonId, dropdownRole }) {
  const role = String(dropdownRole).toUpperCase();
  const rels = [];
  switch (role) {
    case 'SON':
    case 'DAUGHTER':
      rels.push({ person_a_id: existingPersonId, person_b_id: newPersonId, type: 'PARENT_OF', status: 'Approved' });
      break;
    case 'FATHER':
    case 'MOTHER':
      rels.push({ person_a_id: newPersonId, person_b_id: existingPersonId, type: 'PARENT_OF', status: 'Approved' });
      break;
    case 'SPOUSE':
      rels.push({ person_a_id: newPersonId, person_b_id: existingPersonId, type: 'SPOUSE_OF', status: 'Approved' });
      rels.push({ person_a_id: existingPersonId, person_b_id: newPersonId, type: 'SPOUSE_OF', status: 'Approved' });
      break;
  }
  return rels;
}

export function computeRelationshipLabel(focalPersonId, targetPersonId, relationships = [], personMap = new Map()) {
  if (focalPersonId === targetPersonId) return 'Self';
  const targetPerson = personMap.get(targetPersonId);
  const targetGender = (targetPerson?.gender || '').toUpperCase();

  const isSpouse = relationships.some(r => r.type === 'SPOUSE_OF' && ((r.person_a_id === focalPersonId && r.person_b_id === targetPersonId) || (r.person_a_id === targetPersonId && r.person_b_id === focalPersonId)));
  if (isSpouse) return targetGender === 'FEMALE' ? 'Wife' : targetGender === 'MALE' ? 'Husband' : 'Spouse';

  const isParent = relationships.some(r => r.type === 'PARENT_OF' && r.person_a_id === targetPersonId && r.person_b_id === focalPersonId);
  if (isParent) return targetGender === 'FEMALE' ? 'Mother' : 'Father';

  const isChild = relationships.some(r => r.type === 'PARENT_OF' && r.person_a_id === focalPersonId && r.person_b_id === targetPersonId);
  if (isChild) return targetGender === 'FEMALE' ? 'Daughter' : 'Son';

  const focalParents = relationships.filter(r => r.type === 'PARENT_OF' && r.person_b_id === focalPersonId).map(r => r.person_a_id);
  const targetParents = relationships.filter(r => r.type === 'PARENT_OF' && r.person_b_id === targetPersonId).map(r => r.person_a_id);
  const shared = focalParents.filter(p => targetParents.includes(p));
  if (shared.length > 0) return targetGender === 'FEMALE' ? 'Sister' : 'Brother';

  for (const p of focalParents) {
    if (relationships.some(r => r.type === 'PARENT_OF' && r.person_a_id === targetPersonId && r.person_b_id === p)) {
      return targetGender === 'FEMALE' ? 'Grandmother' : 'Grandfather';
    }
  }

  return 'Family Member';
}
