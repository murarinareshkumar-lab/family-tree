import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDuplicates } from '../lib/duplicates.js';

test('Duplicate Detection - Exact email match blocks creation', () => {
  const existingPersons = [
    { person_id: 'p1', full_name: 'Anil Kumar', email: 'anil.kumar@gmail.com', email_norm: 'anilkumar@gmail.com', phone: '9876543210' }
  ];
  const candidate = { full_name: 'Anil K', email: 'Anil.Kumar+family@gmail.com', phone: '9123456789' };
  const result = checkDuplicates(candidate, existingPersons);
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(result.reason, 'A matching record exists. Please raise a link request.');
  assert.strictEqual(result.flags.includes('EXACT_EMAIL_MATCH'), true);
});

test('Duplicate Detection - Same phone flags for Admin review but does NOT block', () => {
  const existingPersons = [
    { person_id: 'p1', member_ref_id: 'PATFT-0001', full_name: 'Sunita Sharma', email: 'sunita@example.com', phone: '+91 9876543210', phone_norm: '9876543210' }
  ];
  const candidate = { full_name: 'Ramesh Sharma', email: 'ramesh@example.com', phone: '9876543210' };
  const result = checkDuplicates(candidate, existingPersons);
  assert.strictEqual(result.blocked, false);
  assert.strictEqual(result.flags.length, 1);
  assert.strictEqual(result.flags[0].type, 'PHONE_SHARED');
});

test('Duplicate Detection - Minors/Deceased with same name and same father flags for Admin review', () => {
  const existingPersons = [
    { person_id: 'p1', member_ref_id: 'PATFT-0002', full_name: 'Aarav Patil', name_norm: 'aarav patil', father_person_id: 'father-uuid-1', is_deceased: false, dob: '2015-05-10' }
  ];
  const candidate = { full_name: 'Aarav Patil', father_person_id: 'father-uuid-1', dob: '2015-05-10', is_deceased: false };
  const result = checkDuplicates(candidate, existingPersons);
  assert.strictEqual(result.blocked, false);
  const minorFlag = result.flags.find(f => f.type === 'MINOR_OR_PARENT_MATCH');
  assert.ok(minorFlag);
});

test('Duplicate Detection - Fuzzy name match with different family details allows with NO flag', () => {
  const existingPersons = [
    { person_id: 'p1', member_ref_id: 'PATFT-0001', full_name: 'Suresh Patil', name_norm: 'suresh patil', email: 'suresh1@example.com', email_norm: 'suresh1@example.com', phone: '9876543210', father_person_id: 'father-patil-1' }
  ];
  const candidate = { full_name: 'Surresh Patil', email: 'surresh.unique@example.com', phone: '9111222333', father_person_id: 'father-patil-2' };
  const result = checkDuplicates(candidate, existingPersons);
  assert.strictEqual(result.blocked, false);
  assert.strictEqual(result.flags.length, 0);
});
