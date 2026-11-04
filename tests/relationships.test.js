import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelationship, convertDropdownToRelationships, computeRelationshipLabel } from '../lib/relationships.js';

test('Relationship Validation - Max 1 father and max 1 mother per person', () => {
  const persons = [
    { person_id: 'p1', full_name: 'Father One', gender: 'MALE' },
    { person_id: 'p2', full_name: 'Father Two', gender: 'MALE' },
    { person_id: 'child1', full_name: 'Child One', gender: 'FEMALE' }
  ];
  const existingRelationships = [
    { person_a_id: 'p1', person_b_id: 'child1', type: 'PARENT_OF', status: 'Approved' }
  ];
  const result = validateRelationship({
    personAId: 'p2', personBId: 'child1', type: 'PARENT_OF', existingRelationships, persons
  });
  assert.strictEqual(result.valid, false);
  assert.match(result.error, /already has a recorded father/i);
});

test('Relationship Validation - Impossible age gap (< 12 years)', () => {
  const persons = [
    { person_id: 'p1', full_name: 'Young Parent', gender: 'MALE', dob: '2005-01-01' },
    { person_id: 'c1', full_name: 'Child', gender: 'MALE', dob: '2010-01-01' }
  ];
  const result = validateRelationship({
    personAId: 'p1', personBId: 'c1', type: 'PARENT_OF', existingRelationships: [], persons
  });
  assert.strictEqual(result.valid, false);
  assert.match(result.error, /Impossible age gap/i);
});

test('Relationship Validation - Cycle Detection (person cannot be their own ancestor)', () => {
  const existingRelationships = [
    { person_a_id: 'A', person_b_id: 'B', type: 'PARENT_OF', status: 'Approved' },
    { person_a_id: 'B', person_b_id: 'C', type: 'PARENT_OF', status: 'Approved' }
  ];
  const result = validateRelationship({
    personAId: 'C', personBId: 'A', type: 'PARENT_OF', existingRelationships, persons: []
  });
  assert.strictEqual(result.valid, false);
  assert.match(result.error, /circular ancestor cycle/i);
});

test('Dropdown to Relationships Conversion - Creates correct primitive links and reciprocals', () => {
  const daughterLinks = convertDropdownToRelationships({
    newPersonId: 'child_new', existingPersonId: 'father_existing', dropdownRole: 'DAUGHTER'
  });
  assert.strictEqual(daughterLinks.length, 1);
  assert.strictEqual(daughterLinks[0].person_a_id, 'father_existing');
  assert.strictEqual(daughterLinks[0].person_b_id, 'child_new');
  assert.strictEqual(daughterLinks[0].type, 'PARENT_OF');

  const spouseLinks = convertDropdownToRelationships({
    newPersonId: 'wife_new', existingPersonId: 'husband_existing', dropdownRole: 'SPOUSE'
  });
  assert.strictEqual(spouseLinks.length, 2);
  assert.strictEqual(spouseLinks[0].person_a_id, 'wife_new');
  assert.strictEqual(spouseLinks[0].person_b_id, 'husband_existing');
  assert.strictEqual(spouseLinks[1].person_a_id, 'husband_existing');
  assert.strictEqual(spouseLinks[1].person_b_id, 'wife_new');
});

test('Dynamic Relationship Calculation - Computes brother, sister, grandparents on read', () => {
  const persons = [
    { person_id: 'dad', full_name: 'Dad', gender: 'MALE' },
    { person_id: 'mom', full_name: 'Mom', gender: 'FEMALE' },
    { person_id: 'son1', full_name: 'Son 1', gender: 'MALE' },
    { person_id: 'daughter1', full_name: 'Daughter 1', gender: 'FEMALE' },
    { person_id: 'grandpa', full_name: 'Grandpa', gender: 'MALE' }
  ];
  const personMap = new Map(persons.map(p => [p.person_id, p]));
  const rels = [
    { person_a_id: 'grandpa', person_b_id: 'dad', type: 'PARENT_OF' },
    { person_a_id: 'dad', person_b_id: 'son1', type: 'PARENT_OF' },
    { person_a_id: 'dad', person_b_id: 'daughter1', type: 'PARENT_OF' },
    { person_a_id: 'mom', person_b_id: 'son1', type: 'PARENT_OF' },
    { person_a_id: 'mom', person_b_id: 'daughter1', type: 'PARENT_OF' },
    { person_a_id: 'dad', person_b_id: 'mom', type: 'SPOUSE_OF' }
  ];
  assert.strictEqual(computeRelationshipLabel('son1', 'dad', rels, personMap), 'Father');
  assert.strictEqual(computeRelationshipLabel('son1', 'mom', rels, personMap), 'Mother');
  assert.strictEqual(computeRelationshipLabel('son1', 'daughter1', rels, personMap), 'Sister');
  assert.strictEqual(computeRelationshipLabel('daughter1', 'son1', rels, personMap), 'Brother');
  assert.strictEqual(computeRelationshipLabel('son1', 'grandpa', rels, personMap), 'Grandfather');
});
