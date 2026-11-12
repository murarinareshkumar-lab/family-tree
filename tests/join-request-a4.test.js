import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider, setSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { checkA4FamilyMatch } from '../lib/duplicates.js';
import adminRequestsHandler from '../server/routes/admin-requests.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-at-least-32-characters-long';

function makeAdminCookie() {
  const token = jwt.sign({ sub: 'admin', email: 'admin@familytree.org', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  return `admin_token=${token}`;
}

test('A4 Family Match - Detects duplicate Name and DOB within family as a warning', () => {
  const familyPersons = [
    {
      person_id: 'p-1',
      member_ref_id: 'MU-NAR-071995-001',
      full_name: 'Naresh Kumar Murari',
      first_name: 'Naresh',
      last_name: 'Murari',
      dob: '1995-07-15'
    }
  ];

  // Identical Name and DOB triggers warning
  const candDuplicate = {
    first_name: 'Naresh',
    last_name: 'Murari',
    dob: '1995-07-15'
  };
  const res1 = checkA4FamilyMatch(candDuplicate, familyPersons);
  assert.strictEqual(res1.warning, true);
  assert.strictEqual(res1.code, 'A4_FAMILY_MATCH');

  // Different DOB does not trigger warning
  const candDifferentDob = {
    first_name: 'Naresh',
    last_name: 'Murari',
    dob: '1998-05-20'
  };
  const res2 = checkA4FamilyMatch(candDifferentDob, familyPersons);
  assert.strictEqual(res2.warning, false);

  // Different Name does not trigger warning
  const candDifferentName = {
    first_name: 'Suresh',
    last_name: 'Murari',
    dob: '1995-07-15'
  };
  const res3 = checkA4FamilyMatch(candDifferentName, familyPersons);
  assert.strictEqual(res3.warning, false);
});

test('Admin Approval - Phone verification fallback allows approval when no email', async () => {
  const sheets = new InMemorySheetsProvider();
  setSheetsClient(sheets);

  // Setup founding family and member
  await sheets.appendRow(TABS.SURNAMES, {
    surname_ref_id: 'FT-MURARI',
    surname_name: 'Murari',
    surname_norm: 'MURARI',
    branch_no: '1',
    status: 'Approved'
  });

  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'p-parent-1',
    member_ref_id: 'MU-RAM-011960-001',
    surname_ref_id: 'FT-MURARI',
    first_name: 'Ramesh',
    last_name: 'Murari',
    full_name: 'Ramesh Murari',
    dob: '1960-01-01',
    status: 'Approved'
  });

  // Create ADD_MEMBER ticket without email verification
  const ticketId = 'TKT-MEM-888999';
  await sheets.appendRow(TABS.REQUESTS, {
    ticket_id: ticketId,
    type: 'ADD_MEMBER',
    payload_json: JSON.stringify({
      surname_ref_id: 'FT-MURARI',
      relative_person_id: 'p-parent-1',
      relationship_type: 'CHILD_OF',
      person: {
        first_name: 'Anand',
        last_name: 'Murari',
        full_name: 'Anand Murari',
        dob: '2015-05-10',
        is_deceased: false,
        email: '',
        phone: ''
      }
    }),
    requester_email: 'guardian@familytree.org',
    mail_verified: 'false',
    phone_verified: 'false',
    status: 'Pending'
  });

  // Attempt approval before verification must fail
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
      end(str) {
        if (str && !this.data) {
          try { this.data = JSON.parse(str); } catch { this.data = str; }
        }
      }
    };
  }

  let mockRes = createMockRes();

  await adminRequestsHandler(
    {
      method: 'PATCH',
      headers: { 'x-admin-key': 'admin123' },
      body: { ticket_id: ticketId, action: 'APPROVE' }
    },
    mockRes
  );
  assert.strictEqual(mockRes.statusCode, 400);
  assert.match(mockRes.data.error, /verification is confirmed/);

  // Record Phone Verification call
  mockRes = createMockRes();

  await adminRequestsHandler(
    {
      method: 'PATCH',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'RECORD_PHONE_VERIFICATION',
        phone_number: '+919876543210',
        phone_verified_note: 'Called guardian to verify minor child'
      }
    },
    mockRes
  );
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.data.success, true);

  // Now approval succeeds
  mockRes = createMockRes();

  await adminRequestsHandler(
    {
      method: 'PATCH',
      headers: { 'x-admin-key': 'admin123' },
      body: { ticket_id: ticketId, action: 'APPROVE' }
    },
    mockRes
  );
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.data.success, true);
  // Verify SS-FFF-MMYYYY-NNN Member Reference ID format with global sequence increment
  assert.strictEqual(mockRes.data.member_ref_id, 'MU-ANA-052015-002');

  // Verify person was created in Persons tab
  const persons = await sheets.getRows(TABS.PERSONS);
  const created = persons.find(p => p.member_ref_id === 'MU-ANA-052015-002');
  assert.ok(created);
  assert.strictEqual(created.status, 'Approved');
});
