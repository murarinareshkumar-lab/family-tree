import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFullName } from '../lib/security.js';
import {
  validateName,
  validateEmail,
  validatePhone,
  parseAndValidateDob
} from '../lib/validation.js';
import { generateSurnameRefId, computeNextBranchNo } from '../lib/id-generator.js';
import { performSurnameSearch } from '../api/surnames/search.js';
import { TABS } from '../lib/schema.js';

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

  // Invalid length
  assert.equal(validatePhone('987654321', true).valid, false);
  assert.equal(validatePhone('98765432100', true).valid, false);

  // Invalid non-digits
  assert.equal(validatePhone('98765ABCD0', true).valid, false);
});

test('Date of Birth Rules - DDMMYYYY, calendar validity, leap years, 18+ check, and YYYY-MM-DD output', () => {
  const d1 = parseAndValidateDob('01011980');
  assert.equal(d1.valid, true);
  assert.equal(d1.value, '1980-01-01');
  assert.equal(d1.display, '01/01/1980');

  const d2 = parseAndValidateDob('15/08/1947');
  assert.equal(d2.valid, true);
  assert.equal(d2.value, '1947-08-15');

  // Leap year check
  assert.equal(parseAndValidateDob('29022000').valid, true);
  assert.equal(parseAndValidateDob('29021999').valid, false);

  // Invalid day for month
  assert.equal(parseAndValidateDob('31041990').valid, false);

  // Year before 1900
  assert.equal(parseAndValidateDob('01011899').valid, false);

  // Future date
  const futureYear = new Date().getFullYear() + 2;
  assert.equal(parseAndValidateDob(`0101${futureYear}`).valid, false);

  // 18+ check
  const currentYear = new Date().getFullYear();
  assert.equal(parseAndValidateDob(`0101${currentYear - 10}`, { minAge: 18 }).valid, false);
  assert.equal(parseAndValidateDob(`0101${currentYear - 25}`, { minAge: 18 }).valid, true);
});

test('Name Composition - Full name build with and without middle name', () => {
  assert.equal(composeFullName('Gurubheema', '', 'Murari'), 'Gurubheema Murari');
  assert.equal(composeFullName('Neeraja', 'Kumari', 'Murari'), 'Neeraja Kumari Murari');
  assert.equal(composeFullName('  Anil  ', '  Kumar  ', '  Patil  '), 'Anil Kumar Patil');
});

test('Surname Search API - No match returns clean empty structure', async () => {
  const mockSheetsClient = {
    getRows: async () => []
  };

  const res = await performSurnameSearch('Murari', mockSheetsClient);
  assert.equal(res.ok, true);
  assert.equal(res.found, false);
  assert.equal(res.pending, false);
  assert.deepEqual(res.families, []);
});

test('Surname Search API - Matches 1 family and 2 families sharing same surname, strict whitelist', async () => {
  const mockSurnames = [
    { surname_ref_id: 'MURFT', surname_name: 'Murari', surname_norm: 'MURARI', status: 'Approved' },
    { surname_ref_id: 'MURAFT', surname_name: 'Murari', surname_norm: 'MURARI', status: 'Approved' }
  ];

  const mockPersons = [
    // Family 1: MURFT
    {
      person_id: 'p-1',
      member_ref_id: 'MURFT-0001',
      surname_ref_id: 'MURFT',
      full_name: 'Gurubheema Murari',
      founding_role: 'HUSBAND',
      status: 'Approved',
      dob: '1950-01-01',
      email: 'secret.guru@example.com',
      phone: '9449980208'
    },
    {
      person_id: 'p-2',
      member_ref_id: 'MURFT-0002',
      surname_ref_id: 'MURFT',
      full_name: 'Neeraja Kumari Murari',
      founding_role: 'WIFE',
      status: 'Approved',
      dob: '1960-01-01',
      email: 'secret.neeraja@example.com',
      phone: '9876543210'
    },
    {
      person_id: 'p-3',
      member_ref_id: 'MURFT-0003',
      surname_ref_id: 'MURFT',
      full_name: 'Child Murari',
      founding_role: '',
      status: 'Approved',
      dob: '1985-01-01'
    },
    // Family 2: MURAFT
    {
      person_id: 'p-4',
      member_ref_id: 'MURAFT-0001',
      surname_ref_id: 'MURAFT',
      full_name: 'Venkatesh Murari',
      founding_role: 'HUSBAND',
      status: 'Approved',
      dob: '1965-01-01',
      email: 'secret.venkat@example.com',
      phone: '9845012345'
    },
    {
      person_id: 'p-5',
      member_ref_id: 'MURAFT-0002',
      surname_ref_id: 'MURAFT',
      full_name: 'Lakshmi Murari',
      founding_role: 'WIFE',
      status: 'Approved',
      dob: '1970-01-01',
      email: 'secret.lakshmi@example.com',
      phone: '9845098765'
    }
  ];

  const mockSheetsClient = {
    getRows: async (tab) => {
      if (tab === TABS.SURNAMES || tab === 'FT_Surname_Details' || tab === 'Surnames') return mockSurnames;
      if (tab === TABS.PERSONS || tab === 'FT_User_Details' || tab === 'Persons') return mockPersons;
      return [];
    }
  };

  const res = await performSurnameSearch('Murari', mockSheetsClient);
  assert.equal(res.ok, true);
  assert.equal(res.found, true);
  assert.equal(res.pending, false);
  assert.equal(res.families.length, 2);

  // Family 1
  const fam1 = res.families[0];
  assert.equal(fam1.surname_ref_id, 'MURFT');
  assert.deepEqual(fam1.husband, { name: 'Gurubheema Murari', member_ref_id: 'MURFT-0001' });
  assert.deepEqual(fam1.wife, { name: 'Neeraja Kumari Murari', member_ref_id: 'MURFT-0002' });

  // Family 2
  const fam2 = res.families[1];
  assert.equal(fam2.surname_ref_id, 'MURAFT');
  assert.deepEqual(fam2.husband, { name: 'Venkatesh Murari', member_ref_id: 'MURAFT-0001' });
  assert.deepEqual(fam2.wife, { name: 'Lakshmi Murari', member_ref_id: 'MURAFT-0002' });

  // Strict Whitelist Check: NEVER return DOB, email, phone, parent IDs, or child members
  for (const fam of res.families) {
    const keys = Object.keys(fam).sort();
    assert.deepEqual(keys, ['branch_no', 'husband', 'surname_ref_id', 'wife']);

    assert.equal(fam.dob, undefined);
    assert.equal(fam.email, undefined);
    assert.equal(fam.phone, undefined);
    assert.equal(fam.husband.dob, undefined);
    assert.equal(fam.husband.email, undefined);
    assert.equal(fam.husband.phone, undefined);
    assert.equal(fam.wife.dob, undefined);
    assert.equal(fam.wife.email, undefined);
    assert.equal(fam.wife.phone, undefined);
  }
});

test('Surname Search API - pending=true when ONBOARD_SURNAME request is awaiting approval', async () => {
  const mockSheetsClient = {
    getRows: async (tab) => {
      if (tab === TABS.REQUESTS || tab === 'FT_Requests' || tab === 'Requests') {
        return [
          {
            ticket_id: 'TKT-1234',
            type: 'ONBOARD_SURNAME',
            status: 'Pending',
            payload_json: JSON.stringify({ surname: 'Murari', husband: {}, wife: {} })
          }
        ];
      }
      return [];
    }
  };

  const res = await performSurnameSearch('Murari', mockSheetsClient);
  assert.equal(res.ok, true);
  assert.equal(res.pending, true);
  assert.equal(res.found, false);
  assert.deepEqual(res.families, []);
});

test('Surname Family Branches - Branch numbering across multiple approved families', () => {
  const families = [
    { surname_ref_id: 'FT-AAAAAA', surname_name: 'Murari', surname_norm: 'MURARI', branch_no: '1', status: 'Approved' },
    { surname_ref_id: 'FT-BBBBBB', surname_name: 'Murari', surname_norm: 'MURARI', branch_no: '2', status: 'Approved' }
  ];
  const nextBranch = computeNextBranchNo('Murari', families);
  assert.equal(nextBranch, 3);
});
