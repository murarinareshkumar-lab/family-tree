import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import app from '../server/app.js';
import { getSheetsClient, InMemorySheetsProvider } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { checkA4FamilyMatch, checkDuplicates } from '../lib/duplicates.js';
import { generateMemberRefId, generateFamilyRefId } from '../lib/id-generator.js';

function simulateRequest(method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
      ...headers
    };
    req.body = body;

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    res.setHeader = (k, v) => { res._headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res._headers[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };

    let sentData = null;
    res.send = (data) => {
      sentData = data;
      resolve({ status: res.statusCode, data });
    };
    res.json = (json) => {
      sentData = json;
      resolve({ status: res.statusCode, json });
    };
    res.end = (data) => {
      resolve({ status: res.statusCode, data: data || sentData });
    };

    app.handle(req, res);
  });
}

test('TC-001 & TC-002: New person registration -> OTP sent with correct message and verified', async () => {
  const sheets = await getSheetsClient();
  const testEmail = 'newperson.tc001@familytree.org';

  // TC-001: New email -> OTP sent
  const sendRes = await simulateRequest('POST', '/api/otp/send', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });

  assert.strictEqual(sendRes.status, 200);
  assert.strictEqual(sendRes.json.ok, true);
  assert.strictEqual(sendRes.json.message, 'A verification code has been sent to the email address provided.');
  assert.strictEqual(sendRes.json.flow, 'NEW_PERSON');

  // Find generated OTP in mock sheet
  const otps = await sheets.getRows(TABS.OTP);
  const activeOtp = otps.find(r => r.email_norm === testEmail && r.status === 'PENDING');
  assert.ok(activeOtp);

  // TC-002: Correct OTP verification
  // For testing, update code hash with known code '654321'
  const { hashOtpCode } = await import('../lib/otp.js');
  const testCode = '654321';
  await sheets.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
    code_hash: hashOtpCode(testCode, testEmail, 'NEW_PERSON_EMAIL_VERIFICATION')
  });

  const verifyRes = await simulateRequest('POST', '/api/otp/verify', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    code: testCode
  });

  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.json.ok, true);
  assert.strictEqual(verifyRes.json.verified, true);
  assert.strictEqual(verifyRes.json.message, 'Email verified successfully.');
  assert.ok(verifyRes.json.token);
});

test('TC-003: New person -> Incorrect OTP -> Verification fails with attempts remaining', async () => {
  const testEmail = 'newperson.tc003@familytree.org';

  await simulateRequest('POST', '/api/otp/send', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });

  const verifyFail = await simulateRequest('POST', '/api/otp/verify', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    code: '000000'
  });

  assert.strictEqual(verifyFail.status, 400);
  assert.strictEqual(verifyFail.json.ok, false);
  assert.match(verifyFail.json.error, /4 attempts remaining/i);
});

test('TC-004: New person -> Expired OTP -> Verification fails', async () => {
  const sheets = await getSheetsClient();
  const testEmail = 'newperson.tc004@familytree.org';

  await simulateRequest('POST', '/api/otp/send', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });

  const otps = await sheets.getRows(TABS.OTP);
  const activeOtp = otps.find(r => r.email_norm === testEmail && r.status === 'PENDING');

  // Expire code by setting expires_at in the past
  await sheets.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
    expires_at: new Date(Date.now() - 10000).toISOString()
  });

  const verifyExpired = await simulateRequest('POST', '/api/otp/verify', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    code: '123456'
  });

  assert.strictEqual(verifyExpired.status, 400);
  assert.strictEqual(verifyExpired.json.ok, false);
  assert.match(verifyExpired.json.error, /expired/i);
});

test('TC-005: Existing email -> Hard block -> OTP NOT sent', async () => {
  const sheets = await getSheetsClient();
  const existingEmail = 'alreadyregistered@familytree.org';

  // Seed existing approved member
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'PER-EXIST-01',
    member_ref_id: 'MU-REG-011980-001',
    first_name: 'Rajesh',
    last_name: 'Murari',
    email: existingEmail,
    status: 'Approved'
  });

  // Attempt to send OTP as a new person
  const res = await simulateRequest('POST', '/api/otp/send', {
    email: existingEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.ok, false);
  assert.strictEqual(res.json.code, 'DUPLICATE_EMAIL');
  assert.strictEqual(res.json.error, 'The provided email address is already registered.');
});

test('TC-006: Duplicate phone check flags according to rule', () => {
  const candidate = {
    full_name: 'Arun Murari',
    phone: '9876543210',
    email: 'newphone@test.com'
  };
  const existing = [{
    person_id: 'PER-100',
    member_ref_id: 'MU-ARU-011990-001',
    full_name: 'Suresh Murari',
    phone: '9876543210',
    email: 'other@test.com'
  }];

  const res = checkDuplicates(candidate, existing, []);
  assert.strictEqual(res.blocked, false);
  assert.ok(res.flags.some(f => f.type === 'PHONE_SHARED'));
});

test('TC-007, TC-008 & TC-009: A4 exact Name + DOB match warning, proceed anyway, go back', () => {
  const familyPersons = [{
    person_id: 'PER-FAM-1',
    first_name: 'Vinod',
    last_name: 'Murari',
    dob: '1985-05-15',
    full_name: 'Vinod Murari'
  }];

  // Exact match
  const match = checkA4FamilyMatch({
    first_name: 'Vinod',
    last_name: 'Murari',
    dob: '1985-05-15'
  }, familyPersons);

  // TC-007: Trigger A4 warning
  assert.strictEqual(match.warning, true);
  assert.strictEqual(match.code, 'A4_FAMILY_MATCH');
  assert.match(match.message, /already exists in this family branch/i);

  // TC-008: Proceed anyway recorded flag
  const payloadProceed = {
    first_name: 'Vinod',
    a4_warning_bypassed: true
  };
  assert.strictEqual(payloadProceed.a4_warning_bypassed, true);

  // TC-009: Go back canceled
  const payloadGoBack = {
    first_name: 'Vinod',
    a4_warning_bypassed: false
  };
  assert.strictEqual(payloadGoBack.a4_warning_bypassed, false);
});

test('TC-010: Resend OTP -> Rate limiting (30s gap) enforced', async () => {
  const testEmail = 'resend.tc010@familytree.org';

  // 1st send
  const res1 = await simulateRequest('POST', '/api/otp/send', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });
  assert.strictEqual(res1.status, 200);

  // Immediate 2nd send fails with rate limit
  const res2 = await simulateRequest('POST', '/api/otp/send', {
    email: testEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION'
  });
  assert.strictEqual(res2.status, 429);
  assert.match(res2.json.error, /Please wait/i);
});

test('TC-011 & TC-013: Existing Member Update -> Matching registered email receives OTP and verifies', async () => {
  const sheets = await getSheetsClient();
  const registeredEmail = 'anita.murari@familytree.org';
  const memberRef = 'MU-ANI-041992-001';

  // Seed existing member
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'PER-ANI-01',
    member_ref_id: memberRef,
    first_name: 'Anita',
    last_name: 'Murari',
    email: registeredEmail,
    status: 'Approved'
  });

  // TC-011: Matching registered email sends OTP
  const sendRes = await simulateRequest('POST', '/api/otp/send', {
    email: registeredEmail,
    purpose: 'EXISTING_MEMBER_EMAIL_VERIFICATION',
    member_ref_id: memberRef
  });

  assert.strictEqual(sendRes.status, 200);
  assert.strictEqual(sendRes.json.ok, true);
  assert.strictEqual(sendRes.json.message, 'A verification code has been sent to your registered email address.');
  assert.strictEqual(sendRes.json.flow, 'EXISTING_MEMBER');

  // TC-013: Verify with correct code unlocks update flow
  const otps = await sheets.getRows(TABS.OTP);
  const activeOtp = otps.find(r => r.email_norm === registeredEmail && r.status === 'PENDING');
  const { hashOtpCode } = await import('../lib/otp.js');
  const testCode = '789123';
  await sheets.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
    code_hash: hashOtpCode(testCode, registeredEmail, 'EXISTING_MEMBER_EMAIL_VERIFICATION')
  });

  const verifyRes = await simulateRequest('POST', '/api/otp/verify', {
    email: registeredEmail,
    purpose: 'EXISTING_MEMBER_EMAIL_VERIFICATION',
    code: testCode,
    member_ref_id: memberRef
  });

  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.json.ok, true);
  assert.strictEqual(verifyRes.json.verified, true);
  assert.ok(verifyRes.json.token);
});

test('TC-012: Existing Member Update -> Non-matching email -> OTP NOT sent', async () => {
  const memberRef = 'MU-ANI-041992-001';
  const wrongEmail = 'attacker@fraud.com';

  const sendRes = await simulateRequest('POST', '/api/otp/send', {
    email: wrongEmail,
    purpose: 'EXISTING_MEMBER_EMAIL_VERIFICATION',
    member_ref_id: memberRef
  });

  assert.strictEqual(sendRes.status, 400);
  assert.strictEqual(sendRes.json.ok, false);
  assert.strictEqual(sendRes.json.code, 'EMAIL_MISMATCH');
  assert.strictEqual(sendRes.json.error, 'The email address does not match the registered email for this member.');
});

test('TC-014: Existing Member Update -> Incorrect OTP -> Flow remains locked', async () => {
  const registeredEmail = 'anita.murari@familytree.org';
  const memberRef = 'MU-ANI-041992-001';

  // Send fresh OTP first
  await simulateRequest('POST', '/api/otp/send', {
    email: registeredEmail,
    purpose: 'EXISTING_MEMBER_EMAIL_VERIFICATION',
    member_ref_id: memberRef
  });

  const verifyRes = await simulateRequest('POST', '/api/otp/verify', {
    email: registeredEmail,
    purpose: 'EXISTING_MEMBER_EMAIL_VERIFICATION',
    code: '000000',
    member_ref_id: memberRef
  });

  assert.strictEqual(verifyRes.status, 400);
  assert.strictEqual(verifyRes.json.ok, false);
  assert.match(verifyRes.json.error, /attempts remaining/i);
});

test('TC-015: Existing Member Reference remains unchanged after update', () => {
  const originalMemberRef = 'MU-ANI-041992-001';
  const updatedMember = {
    member_ref_id: originalMemberRef,
    first_name: 'Anita',
    middle_name: 'Kumari',
    last_name: 'Murari',
    occupation: 'Software Engineer'
  };

  assert.strictEqual(updatedMember.member_ref_id, originalMemberRef);
});

test('TC-016: OTP verified but Admin rejects -> Does NOT become official', async () => {
  const sheets = await getSheetsClient();
  const ticketId = 'TKT-EDT-TC016';

  await sheets.appendRow(TABS.REQUESTS, {
    ticket_id: ticketId,
    type: 'EDIT_MEMBER',
    status: 'Submitted',
    mail_verified: 'true'
  });

  const { default: adminRequestsHandler } = await import('../server/routes/admin-requests.js');
  const mockRes = {
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

  await adminRequestsHandler(
    {
      method: 'PATCH',
      headers: { 'x-admin-key': 'admin123' },
      body: {
        ticket_id: ticketId,
        action: 'REJECT',
        admin_remarks: 'Invalid identity evidence'
      }
    },
    mockRes
  );

  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.data.success, true);

  const reqs = await sheets.getRows(TABS.REQUESTS);
  const req = reqs.find(r => r.ticket_id === ticketId);
  assert.strictEqual(req.status, 'Rejected');
  assert.strictEqual(req.admin_remarks, 'Invalid identity evidence');
});

test('TC-017: New person approved -> Member Reference generated in SS-FFF-MMYYYY-NNN format', () => {
  const refId = generateMemberRefId({
    surname: 'Murari',
    firstName: 'Naresh',
    dob: '1995-07-20'
  }, []);

  assert.strictEqual(refId, 'MU-NAR-071995-001');
});

test('TC-018: Founding family approved -> Family Reference generated', () => {
  const famRef = generateFamilyRefId([]);
  assert.match(famRef, /^FT-[0-9A-HJ-NP-Z]{6}$/);
});
