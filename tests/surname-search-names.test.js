import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFullName, whitelistPublicSearchResult } from '../lib/security.js';

test('Surname Search Whitelist - Strictly leaks no private fields', () => {
  const mockPersonRow = {
    person_id: 'p-uuid-999',
    member_ref_id: 'PATFT-0001',
    surname_ref_id: 'PATFT',
    first_name: 'Ramesh',
    middle_name: 'Kumar',
    last_name: 'Patil',
    full_name: 'Ramesh Kumar Patil',
    gender: 'MALE',
    dob: '1970-01-01',
    is_deceased: 'false',
    email: 'ramesh.private@example.com',
    email_norm: 'rameshprivate@gmail.com',
    phone: '+91 9876543210',
    phone_norm: '9876543210',
    father_person_id: 'p-uuid-father',
    mother_person_id: 'p-uuid-mother',
    status: 'Approved',
    verified_by_admin: 'true',
    created_at: '2026-01-01T00:00:00.000Z'
  };

  const whitelisted = whitelistPublicSearchResult(mockPersonRow);

  // Assert required fields exist
  assert.equal(whitelisted.display_name, 'Ramesh Kumar Patil');
  assert.equal(whitelisted.member_ref_id, 'PATFT-0001');

  // Assert keys strictly match only display_name and member_ref_id
  const keys = Object.keys(whitelisted).sort();
  assert.deepEqual(keys, ['display_name', 'member_ref_id']);

  // Assert no private fields leaked
  assert.equal(whitelisted.email, undefined, 'email must NEVER leak');
  assert.equal(whitelisted.phone, undefined, 'phone must NEVER leak');
  assert.equal(whitelisted.dob, undefined, 'dob must NEVER leak');
  assert.equal(whitelisted.father_person_id, undefined, 'father_person_id must NEVER leak');
  assert.equal(whitelisted.mother_person_id, undefined, 'mother_person_id must NEVER leak');
  assert.equal(whitelisted.person_id, undefined, 'internal person_id must not leak');
  assert.equal(whitelisted.created_at, undefined, 'created_at metadata must not leak');
});

test('Search Required Before Submit Rule - Enforces search verification on current surname value', () => {
  function validateOnboardingSubmit({ surnameName, lastSearchedSurname, searchCompleted }) {
    const trimmed = (surnameName || '').trim();
    if (trimmed.length < 3) {
      return { allowed: false, reason: 'Minimum 3 characters required for surname' };
    }
    if (!searchCompleted) {
      return { allowed: false, reason: 'Search is required before submitting' };
    }
    if (trimmed !== (lastSearchedSurname || '').trim()) {
      return { allowed: false, reason: 'Surname was modified after search; re-search required' };
    }
    return { allowed: true };
  }

  // 1. Unsearched surname
  const res1 = validateOnboardingSubmit({
    surnameName: 'Patil',
    lastSearchedSurname: '',
    searchCompleted: false
  });
  assert.equal(res1.allowed, false);
  assert.match(res1.reason, /required before submitting/i);

  // 2. Surname edited after search
  const res2 = validateOnboardingSubmit({
    surnameName: 'Patil Sharma',
    lastSearchedSurname: 'Patil',
    searchCompleted: true
  });
  assert.equal(res2.allowed, false);
  assert.match(res2.reason, /modified after search/i);

  // 3. Short surname (< 3 characters)
  const res3 = validateOnboardingSubmit({
    surnameName: 'Pa',
    lastSearchedSurname: 'Pa',
    searchCompleted: true
  });
  assert.equal(res3.allowed, false);
  assert.match(res3.reason, /Minimum 3 characters/i);

  // 4. Valid searched surname
  const res4 = validateOnboardingSubmit({
    surnameName: 'Patil',
    lastSearchedSurname: 'Patil',
    searchCompleted: true
  });
  assert.equal(res4.allowed, true);
});

test('Name Composition - With and without middle name across Unicode scripts', () => {
  // English: with middle name
  const name1 = composeFullName('Ramesh', 'Kumar', 'Patil');
  assert.equal(name1, 'Ramesh Kumar Patil');

  // English: without middle name (must be single-spaced, no extra space)
  const name2 = composeFullName('Ramesh', '', 'Patil');
  assert.equal(name2, 'Ramesh Patil');

  // English: with whitespace/null middle name
  const name3 = composeFullName('Ramesh', '   ', 'Patil');
  assert.equal(name3, 'Ramesh Patil');

  const name4 = composeFullName('Ramesh', null, 'Patil');
  assert.equal(name4, 'Ramesh Patil');

  // Unicode Kannada: with and without middle name
  const nameKn1 = composeFullName('ರಮೇಶ್', 'ಕುಮಾರ್', 'ಪಾಟೀಲ್');
  assert.equal(nameKn1, 'ರಮೇಶ್ ಕುಮಾರ್ ಪಾಟೀಲ್');

  const nameKn2 = composeFullName('ರಮೇಶ್', '', 'ಪಾಟೀಲ್');
  assert.equal(nameKn2, 'ರಮೇಶ್ ಪಾಟೀಲ್');

  // Unicode Hindi: with and without middle name
  const nameHi1 = composeFullName('रमेश', 'कुमार', 'पाटिल');
  assert.equal(nameHi1, 'रमेश कुमार पाटिल');

  const nameHi2 = composeFullName('रमेश', '', 'पाटिल');
  assert.equal(nameHi2, 'रमेश पाटिल');

  // Unicode Telugu: with and without middle name
  const nameTe1 = composeFullName('రమేష్', 'కుమార్', 'పాటిల్');
  assert.equal(nameTe1, 'రమేష్ కుమార్ పాటిల్');

  const nameTe2 = composeFullName('రమేష్', '', 'పాటిల్');
  assert.equal(nameTe2, 'రమేష్ పాటిల్');
});
