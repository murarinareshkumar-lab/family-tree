import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFullName, whitelistPublicSearchResult } from '../lib/security.js';
import {
  validateName,
  validateEmail,
  validatePhone,
  parseAndValidateDob,
  cleanPhone
} from '../lib/validation.js';
import { performSurnameSearch } from '../api/surnames/search.js';

test('Name Validation Rules - Unicode, single spaces, reject digits and symbols', () => {
  // 1. English valid
  assert.equal(validateName('Ramesh', true).valid, true);
  assert.equal(validateName('Ramesh Kumar', true).valid, true);
  assert.equal(validateName('Patil', true).valid, true);

  // 2. Unicode valid (Kannada, Hindi, Telugu)
  assert.equal(validateName('ರಮೇಶ್ ಕುಮಾರ್', true).valid, true);
  assert.equal(validateName('पवन कल्याण', true).valid, true);
  assert.equal(validateName('వెంకటేశ్వర రావు', true).valid, true);

  // 3. Optional middle name
  assert.equal(validateName('', false).valid, true);
  assert.equal(validateName(null, false).valid, true);
  assert.equal(validateName('Kumar', false).valid, true);

  // 4. Required missing
  assert.equal(validateName('', true).valid, false);
  assert.equal(validateName('   ', true).valid, false);

  // 5. Rejects digits
  assert.equal(validateName('Ramesh123', true).valid, false);
  assert.equal(validateName('Patil 2', true).valid, false);

  // 6. Rejects symbols
  assert.equal(validateName('Ramesh@Patil', true).valid, false);
  assert.equal(validateName('Ramesh-Kumar', true).valid, false);
  assert.equal(validateName('Patil!', true).valid, false);

  // 7. Rejects double spaces inside
  assert.equal(validateName('Ramesh  Kumar', true).valid, false);

  // 8. Trims leading and trailing spaces
  const trimmed = validateName('  Ramesh  ', true);
  assert.equal(trimmed.valid, true);
  assert.equal(trimmed.value, 'Ramesh');
});

test('Email Validation Rules - Format, lowercase, max 254 chars', () => {
  // Valid formats
  const e1 = validateEmail('Ramesh.Patil@Example.COM', true);
  assert.equal(e1.valid, true);
  assert.equal(e1.value, 'ramesh.patil@example.com');

  const e2 = validateEmail('user+tag@domain.co.in', true);
  assert.equal(e2.valid, true);

  // Invalid formats
  assert.equal(validateEmail('notanemail', true).valid, false);
  assert.equal(validateEmail('missing@domain', true).valid, false);
  assert.equal(validateEmail('@missinguser.com', true).valid, false);
  assert.equal(validateEmail('spaces in@email.com', true).valid, false);

  // Length > 254
  const longEmail = 'a'.repeat(250) + '@example.com';
  assert.equal(validateEmail(longEmail, true).valid, false);

  // Optional email
  assert.equal(validateEmail('', false).valid, true);
});

test('Phone Validation Rules - 10 digits starting with 6-9, stripped +91 and spaces', () => {
  // Valid Indian mobile numbers
  const p1 = validatePhone('9876543210', true);
  assert.equal(p1.valid, true);
  assert.equal(p1.value, '9876543210');

  const p2 = validatePhone('+91 98765 43210', true);
  assert.equal(p2.valid, true);
  assert.equal(p2.value, '9876543210');

  const p3 = validatePhone('918765432100', true);
  assert.equal(p3.valid, true);
  assert.equal(p3.value, '8765432100');

  const p4 = validatePhone('6123456789', true);
  assert.equal(p4.valid, true);
  assert.equal(p4.value, '6123456789');

  const p5 = validatePhone('7123456789', true);
  assert.equal(p5.valid, true);

  // Invalid: Starts with 0, 1, 2, 3, 4, 5
  assert.equal(validatePhone('5123456789', true).valid, false);
  assert.equal(validatePhone('0987654321', true).valid, false);

  // Invalid length (< 10 or > 10 digits)
  assert.equal(validatePhone('987654321', true).valid, false);
  assert.equal(validatePhone('98765432100', true).valid, false);

  // Invalid: Non-digits
  assert.equal(validatePhone('98765ABCD0', true).valid, false);
});

test('Date of Birth Rules - DDMMYYYY, calendar validity, leap years, 18+ check, and YYYY-MM-DD output', () => {
  // 1. Valid DDMMYYYY
  const d1 = parseAndValidateDob('01011980');
  assert.equal(d1.valid, true);
  assert.equal(d1.value, '1980-01-01');
  assert.equal(d1.display, '01/01/1980');

  // 2. Valid DD/MM/YYYY
  const d2 = parseAndValidateDob('15/08/1947');
  assert.equal(d2.valid, true);
  assert.equal(d2.value, '1947-08-15');

  // 3. Leap year check: Feb 29 on leap year (2000, 2024) is valid
  const leapValid = parseAndValidateDob('29022000');
  assert.equal(leapValid.valid, true);
  assert.equal(leapValid.value, '2000-02-29');

  // 4. Leap year check: Feb 29 on non-leap year (1999, 2023) is invalid
  const leapInvalid = parseAndValidateDob('29021999');
  assert.equal(leapInvalid.valid, false);

  // 5. Invalid days per month (April 31 is invalid)
  assert.equal(parseAndValidateDob('31041990').valid, false);

  // 6. Year before 1900 is rejected
  assert.equal(parseAndValidateDob('01011899').valid, false);

  // 7. Future date is rejected
  const futureYear = new Date().getFullYear() + 2;
  assert.equal(parseAndValidateDob(`0101${futureYear}`).valid, false);

  // 8. 18+ check for founding members
  const currentYear = new Date().getFullYear();
  const minorDob = `0101${currentYear - 10}`; // 10 years old
  const adultDob = `0101${currentYear - 25}`; // 25 years old

  assert.equal(parseAndValidateDob(minorDob, { minAge: 18 }).valid, false);
  assert.equal(parseAndValidateDob(adultDob, { minAge: 18 }).valid, true);
});

test('Surname Search Match & Whitelist - Founding husband and wife first, zero private fields leak', async () => {
  const mockSurnames = [
    { surname_ref_id: 'MURFT', surname_name: 'Murari', status: 'Approved', last_seq: '3' }
  ];

  const mockPersons = [
    {
      person_id: 'p-3',
      member_ref_id: 'MURFT-0003',
      surname_ref_id: 'MURFT',
      full_name: 'Anand Murari',
      gender: 'MALE',
      dob: '1985-05-05',
      email: 'anand.secret@example.com',
      phone: '9876543299',
      father_person_id: 'p-1',
      mother_person_id: 'p-2',
      status: 'Approved'
    },
    {
      person_id: 'p-2',
      member_ref_id: 'MURFT-0002',
      surname_ref_id: 'MURFT',
      full_name: 'Neeraja Kumari Murari',
      gender: 'FEMALE',
      dob: '1960-01-01',
      email: 'neeraja.secret@example.com',
      phone: '9876543211',
      status: 'Approved'
    },
    {
      person_id: 'p-1',
      member_ref_id: 'MURFT-0001',
      surname_ref_id: 'MURFT',
      full_name: 'Gurubheema Murari',
      gender: 'MALE',
      dob: '1950-01-01',
      email: 'guru.secret@example.com',
      phone: '9876543210',
      status: 'Approved'
    }
  ];

  const mockRelationships = [
    { rel_id: 'r-1', person_a_id: 'p-1', person_b_id: 'p-2', type: 'SPOUSE_OF', status: 'Approved' },
    { rel_id: 'r-2', person_a_id: 'p-1', person_b_id: 'p-3', type: 'PARENT_OF', status: 'Approved' },
    { rel_id: 'r-3', person_a_id: 'p-2', person_b_id: 'p-3', type: 'PARENT_OF', status: 'Approved' }
  ];

  const mockRequests = [];

  const mockSheetsClient = {
    getRows: async (tab) => {
      if (tab === 'FT_Surname_Details') return mockSurnames;
      if (tab === 'FT_User_Details') return mockPersons;
      if (tab === 'FT_Relationships') return mockRelationships;
      if (tab === 'FT_Requests') return mockRequests;
      return [];
    }
  };

  const searchRes = await performSurnameSearch('Murari', mockSheetsClient);

  assert.equal(searchRes.count, 3);
  assert.equal(searchRes.results.length, 3);

  // 1. Order check: Founding husband first, Founding wife second, then Member
  assert.equal(searchRes.results[0].role, 'Founding husband');
  assert.equal(searchRes.results[0].display_name, 'Gurubheema Murari');
  assert.equal(searchRes.results[0].member_ref_id, 'MURFT-0001');

  assert.equal(searchRes.results[1].role, 'Founding wife');
  assert.equal(searchRes.results[1].display_name, 'Neeraja Kumari Murari');
  assert.equal(searchRes.results[1].member_ref_id, 'MURFT-0002');

  assert.equal(searchRes.results[2].role, 'Member');
  assert.equal(searchRes.results[2].display_name, 'Anand Murari');
  assert.equal(searchRes.results[2].member_ref_id, 'MURFT-0003');

  // 2. Strict Whitelist Check: ZERO private fields leak
  for (const item of searchRes.results) {
    const keys = Object.keys(item).sort();
    assert.deepEqual(keys, ['display_name', 'member_ref_id', 'role']);

    assert.equal(item.dob, undefined, 'DOB must never leak in search results');
    assert.equal(item.email, undefined, 'Email must never leak in search results');
    assert.equal(item.phone, undefined, 'Phone must never leak in search results');
    assert.equal(item.father_person_id, undefined, 'Parent IDs must never leak in search results');
    assert.equal(item.mother_person_id, undefined, 'Parent IDs must never leak in search results');
    assert.equal(item.person_id, undefined, 'Internal person_id must never leak');
  }
});

test('Surname Search No Match - Returns clean empty results', async () => {
  const mockSheetsClient = {
    getRows: async () => []
  };

  const noMatchRes = await performSurnameSearch('NonExistentSurname', mockSheetsClient);

  assert.equal(noMatchRes.count, 0);
  assert.deepEqual(noMatchRes.results, []);
  assert.equal(noMatchRes.has_pending_request, false);
});
