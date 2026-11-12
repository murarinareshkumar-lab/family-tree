import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider, setSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import adminRequestsHandler from '../server/routes/admin-requests.js';
import { REQUEST_TYPE_CONFIG, resolveRequestType } from '../lib/request-types.js';

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

test('ARM-001: Master Enum Mapping resolves all required request types with human labels', () => {
  // 1. NEW_FAMILY_REGISTRATION
  const r1 = resolveRequestType('NEW_FAMILY_REGISTRATION');
  assert.strictEqual(r1.id, 'NEW_FAMILY_REGISTRATION');
  assert.strictEqual(r1.label, 'New Family Registration');

  const r1Alias = resolveRequestType('ONBOARD_SURNAME');
  assert.strictEqual(r1Alias.id, 'NEW_FAMILY_REGISTRATION');

  // 2. ADD_MEMBER
  const r2 = resolveRequestType('ADD_MEMBER');
  assert.strictEqual(r2.id, 'ADD_MEMBER');
  assert.strictEqual(r2.label, 'Add Member');

  // 3. LINK_EXISTING_PERSON
  const r3 = resolveRequestType('LINK_EXISTING_PERSON');
  assert.strictEqual(r3.id, 'LINK_EXISTING_PERSON');
  assert.strictEqual(r3.label, 'Link Existing Person');

  // 4. LINK_SAME_SURNAME_FAMILY
  const r4 = resolveRequestType('LINK_FAMILIES', { link_type: 'MERGE_FAMILIES' });
  assert.strictEqual(r4.id, 'LINK_SAME_SURNAME_FAMILY');
  assert.strictEqual(r4.label, 'Link Same-Surname Family');

  // 5. LINK_DIFFERENT_SURNAME_FAMILY
  const r5 = resolveRequestType('LINK_FAMILIES', { link_type: 'CONNECT_BRANCHES' });
  assert.strictEqual(r5.id, 'LINK_DIFFERENT_SURNAME_FAMILY');
  assert.strictEqual(r5.label, 'Link Different-Surname Family');

  // 6. DELINK_RELATIONSHIP
  const r6 = resolveRequestType('DELINK_RELATIONSHIP');
  assert.strictEqual(r6.id, 'DELINK_RELATIONSHIP');
  assert.strictEqual(r6.label, 'Delink Relationship');

  // 7. EDIT_UPDATE_MEMBER
  const r7 = resolveRequestType('EDIT_UPDATE_MEMBER');
  assert.strictEqual(r7.id, 'EDIT_UPDATE_MEMBER');
  assert.strictEqual(r7.label, 'Edit / Update Member');

  const r7Alias = resolveRequestType('EDIT_MEMBER');
  assert.strictEqual(r7Alias.id, 'EDIT_UPDATE_MEMBER');

  // 8. JOIN_REQUEST
  const r8 = resolveRequestType('JOIN_REQUEST');
  assert.strictEqual(r8.id, 'JOIN_REQUEST');
  assert.strictEqual(r8.label, 'Join Family Tree');
});

test('ARM-002: Combinable Filtering Logic correctly filters mock requests', () => {
  const sampleRequests = [
    {
      ticket_id: 'FT-REQ-001',
      type: 'ONBOARD_SURNAME',
      status: 'Pending',
      requester_email: 'ramesh@murari.org',
      created_at: '2026-11-12T08:30:00Z',
      payload_json: JSON.stringify({ surname_name: 'Murari', submitter_name: 'Ramesh Murari' })
    },
    {
      ticket_id: 'FT-REQ-002',
      type: 'ADD_MEMBER',
      status: 'Pending',
      requester_email: 'suresh@murari.org',
      created_at: '2026-11-12T08:45:00Z',
      payload_json: JSON.stringify({ surname: 'Murari', submitter_name: 'Suresh Murari' })
    },
    {
      ticket_id: 'FT-REQ-003',
      type: 'LINK_EXISTING_PERSON',
      status: 'Approved',
      requester_email: 'anita@sharma.org',
      created_at: '2026-11-10T09:10:00Z',
      payload_json: JSON.stringify({ surname: 'Sharma', submitter_name: 'Anita Sharma', member_ref_id: 'SH-RAM-051980-001' })
    },
    {
      ticket_id: 'FT-REQ-004',
      type: 'EDIT_UPDATE_MEMBER',
      status: 'Approved',
      requester_email: 'ravi@verma.org',
      created_at: '2026-11-08T09:20:00Z',
      payload_json: JSON.stringify({ surname: 'Verma', submitter_name: 'Ravi Verma', member_ref_id: 'VE-KUM-011990-002' })
    },
    {
      ticket_id: 'FT-REQ-005',
      type: 'DELINK_RELATIONSHIP',
      status: 'Rejected',
      requester_email: 'mahesh@patil.org',
      created_at: '2026-11-05T09:35:00Z',
      payload_json: JSON.stringify({ surname: 'Patil', submitter_name: 'Mahesh Patil' })
    }
  ];

  // Filter helper simulating AdminRequestManagement.jsx filtering
  function applyFilters(requests, { searchTerm = '', typeFilter = 'ALL', statusFilter = 'ALL', familyFilter = 'ALL', fromDate = '', toDate = '' }) {
    return requests.filter(r => {
      let payload = {};
      try { payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json; } catch (_) {}

      // 1. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const ticketMatch = String(r.ticket_id || '').toLowerCase().includes(q);
        const emailMatch = String(r.requester_email || '').toLowerCase().includes(q);
        const reqNameMatch = String(payload.submitter_name || payload.requester_name || '').toLowerCase().includes(q);
        const surnameMatch = String(payload.surname || payload.surname_name || '').toLowerCase().includes(q);
        const memberRefMatch = String(payload.member_ref_id || payload.member_ref || '').toLowerCase().includes(q);
        if (!ticketMatch && !emailMatch && !reqNameMatch && !surnameMatch && !memberRefMatch) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'ALL') {
        const config = resolveRequestType(r.type, payload);
        if (config.id !== typeFilter && !config.aliases?.includes(typeFilter)) return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        if (String(r.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // 4. Family Filter
      if (familyFilter !== 'ALL') {
        const famName = payload.surname || payload.surname_name;
        if (famName !== familyFilter) return false;
      }

      // 5. Date Range
      if (fromDate) {
        const reqDate = new Date(r.created_at || 0);
        if (reqDate < new Date(fromDate)) return false;
      }
      if (toDate) {
        const reqDate = new Date(r.created_at || 0);
        const tDate = new Date(toDate);
        tDate.setHours(23, 59, 59, 999);
        if (reqDate > tDate) return false;
      }

      return true;
    });
  }

  // Test 1: Request Type filter = ADD_MEMBER
  const resType = applyFilters(sampleRequests, { typeFilter: 'ADD_MEMBER' });
  assert.strictEqual(resType.length, 1);
  assert.strictEqual(resType[0].ticket_id, 'FT-REQ-002');

  // Test 2: Status = Pending
  const resPending = applyFilters(sampleRequests, { statusFilter: 'Pending' });
  assert.strictEqual(resPending.length, 2);

  // Test 3: Combined: Status = Approved and Family = Sharma
  const resComb = applyFilters(sampleRequests, { statusFilter: 'Approved', familyFilter: 'Sharma' });
  assert.strictEqual(resComb.length, 1);
  assert.strictEqual(resComb[0].ticket_id, 'FT-REQ-003');

  // Test 4: Search by Ticket No
  const resSearchTicket = applyFilters(sampleRequests, { searchTerm: 'REQ-005' });
  assert.strictEqual(resSearchTicket.length, 1);
  assert.strictEqual(resSearchTicket[0].ticket_id, 'FT-REQ-005');

  // Test 5: Search by Member Reference ID
  const resSearchMemberRef = applyFilters(sampleRequests, { searchTerm: 'VE-KUM-011990-002' });
  assert.strictEqual(resSearchMemberRef.length, 1);
  assert.strictEqual(resSearchMemberRef[0].ticket_id, 'FT-REQ-004');

  // Test 6: Date Range filtering
  const resDateRange = applyFilters(sampleRequests, { fromDate: '2026-11-09', toDate: '2026-11-13' });
  assert.strictEqual(resDateRange.length, 3); // REQ-001, REQ-002, REQ-003

  // Test 7: Reset Filter restores all requests
  const resAll = applyFilters(sampleRequests, {});
  assert.strictEqual(resAll.length, 5);
});

test('ARM-003: Server-side Approval of EDIT_UPDATE_MEMBER preserves permanent Member Reference ID', async () => {
  const sheets = new InMemorySheetsProvider();
  setSheetsClient(sheets);

  const permanentRef = 'MU-ANA-031985-001';
  const personId = 'P-MEMBER-EDIT-001';

  // Seed existing member record
  await sheets.appendRow(TABS.PERSONS, {
    person_id: personId,
    member_ref_id: permanentRef,
    first_name: 'Anand',
    last_name: 'Murari',
    full_name: 'Anand Murari',
    dob: '1985-03-20',
    phone: '9876543210',
    email: 'anand.old@murari.org',
    status: 'Approved'
  });

  const ticketId = 'FT-REQ-EDT-100';
  await sheets.appendRow(TABS.REQUESTS, {
    ticket_id: ticketId,
    type: 'EDIT_UPDATE_MEMBER',
    status: 'Pending',
    requester_email: 'anand.new@murari.org',
    mail_verified: 'true',
    payload_json: JSON.stringify({
      member_ref_id: permanentRef,
      person_id: personId,
      updated_details: {
        first_name: 'Ananda',
        last_name: 'Murari',
        email: 'anand.new@murari.org',
        occupation: 'Software Architect'
      }
    })
  });

  // Call admin approve endpoint
  const mockRes = createMockRes();
  await adminRequestsHandler(
    {
      method: 'POST',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'APPROVE',
        mail_verified: true,
        admin_remarks: 'Verified update request'
      }
    },
    mockRes
  );

  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.data.success, true);
  assert.strictEqual(mockRes.data.member_ref_id, permanentRef);

  // Verify member record was updated while preserving permanent Member Reference ID
  const persons = await sheets.getRows(TABS.PERSONS);
  const updatedPerson = persons.find(p => p.person_id === personId);
  assert.strictEqual(updatedPerson.member_ref_id, permanentRef);
  assert.strictEqual(updatedPerson.full_name, 'Ananda Murari');
  assert.strictEqual(updatedPerson.email, 'anand.new@murari.org');
  assert.strictEqual(updatedPerson.occupation, 'Software Architect');

  // Verify request row status is Approved
  const requests = await sheets.getRows(TABS.REQUESTS);
  const reqRow = requests.find(r => r.ticket_id === ticketId);
  assert.strictEqual(reqRow.status, 'Approved');
  assert.ok(reqRow.decided_at);

  // Verify audit log entry exists
  const audits = await sheets.getRows(TABS.AUDIT_LOG);
  const audit = audits.find(a => a.ticket_id === ticketId);
  assert.ok(audit, 'Audit log entry must be created');
  assert.strictEqual(audit.action, 'APPROVE_EDIT_MEMBER');
});

test('ARM-004: Concurrency and Duplicate Processing Prevention (AC-022)', async () => {
  const sheets = new InMemorySheetsProvider();
  setSheetsClient(sheets);

  const ticketId = 'FT-REQ-DUP-TEST';
  await sheets.appendRow(TABS.REQUESTS, {
    ticket_id: ticketId,
    type: 'ADD_MEMBER',
    status: 'Approved', // Already finalized
    requester_email: 'test@example.com',
    mail_verified: 'true'
  });

  // Attempting to approve an already approved ticket must fail with 400
  const mockRes = createMockRes();
  await adminRequestsHandler(
    {
      method: 'POST',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'APPROVE'
      }
    },
    mockRes
  );

  assert.strictEqual(mockRes.statusCode, 400);
  assert.match(mockRes.data.error, /already been processed/);

  // Attempting to reject an already approved ticket must also fail with 400
  const mockRes2 = createMockRes();
  await adminRequestsHandler(
    {
      method: 'POST',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'REJECT',
        admin_remarks: 'Should not allow double processing'
      }
    },
    mockRes2
  );

  assert.strictEqual(mockRes2.statusCode, 400);
  assert.match(mockRes2.data.error, /already been processed/);
});

test('ARM-005: Server-side Rejection requires mandatory explanation', async () => {
  const sheets = new InMemorySheetsProvider();
  setSheetsClient(sheets);

  const ticketId = 'FT-REQ-REJ-TEST';
  await sheets.appendRow(TABS.REQUESTS, {
    ticket_id: ticketId,
    type: 'ONBOARD_SURNAME',
    status: 'Pending',
    requester_email: 'test@reject.org'
  });

  // Rejection without admin_remarks must fail with 400
  const mockResFail = createMockRes();
  await adminRequestsHandler(
    {
      method: 'POST',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'REJECT',
        admin_remarks: '   '
      }
    },
    mockResFail
  );

  assert.strictEqual(mockResFail.statusCode, 400);
  assert.match(mockResFail.data.error, /admin_remarks required|Rejection reason/i);

  // Rejection with mandatory admin_remarks succeeds
  const mockResSuccess = createMockRes();
  await adminRequestsHandler(
    {
      method: 'POST',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'REJECT',
        admin_remarks: 'Incomplete documentation provided'
      }
    },
    mockResSuccess
  );

  assert.strictEqual(mockResSuccess.statusCode, 200);
  assert.strictEqual(mockResSuccess.data.success, true);

  const requests = await sheets.getRows(TABS.REQUESTS);
  const reqRow = requests.find(r => r.ticket_id === ticketId);
  assert.strictEqual(reqRow.status, 'Rejected');
  assert.strictEqual(reqRow.admin_remarks, 'Incomplete documentation provided');
  assert.ok(reqRow.decided_at);
});

test('ARM-006: Unauthorized request without Admin key/token is blocked with 401', async () => {
  const mockRes = createMockRes();
  await adminRequestsHandler(
    {
      method: 'GET',
      headers: {} // No admin auth
    },
    mockRes
  );

  assert.strictEqual(mockRes.statusCode, 401);
  assert.match(mockRes.data.error, /Unauthorized/);
});
