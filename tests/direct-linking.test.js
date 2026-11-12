import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import app from '../server/app.js';
import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { createAndSendOtp, verifyOtp } from '../lib/otp.js';

function simulateExpressRequest(app, method, url, body = null, headers = {}) {
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
      resolve({ status: res.statusCode, json, data: json });
    };
    res.end = (data) => {
      resolve({ status: res.statusCode, data: data || sentData });
    };

    app.handle(req, res);
  });
}

test('Direct Self-Linking - Verifying relative email allows instant direct link into family', async () => {
  const sheetsClient = getSheetsClient();

  // Create an approved relative in PERSONS
  const relPersonId = 'test-rel-p1';
  const relEmail = 'parent.relative@example.com';
  await sheetsClient.appendRow(TABS.PERSONS, {
    person_id: relPersonId,
    member_ref_id: 'MU-PAR-011960-001',
    surname_ref_id: 'FT-TEST01',
    first_name: 'Parent',
    last_name: 'Murari',
    full_name: 'Parent Murari',
    gender: 'MALE',
    email: relEmail,
    email_norm: 'parent.relative@example.com',
    status: 'Approved'
  });

  // Verify email matches via families endpoint
  const verifyFamRes = await simulateExpressRequest(app, 'POST', '/api/families/verify-member-email', {
    person_id: relPersonId,
    email: relEmail
  });
  assert.equal(verifyFamRes.status, 200);
  assert.equal(verifyFamRes.json.verified, true);
  assert.equal(verifyFamRes.json.direct_link_eligible, true);

  // Generate valid OTP token for child
  const childEmail = 'child.selflink@example.com';
  await createAndSendOtp({
    email: childEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    overrideCode: '123456',
    sheetsClient
  });
  const verifyRes = await verifyOtp({
    email: childEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    code: '123456',
    sheetsClient
  });
  const childOtpToken = verifyRes.token;

  const mockPayload = {
    type: 'ADD_MEMBER',
    direct_link: true,
    requester_email: childEmail,
    otp_token: childOtpToken,
    payload: {
      surname_ref_id: 'FT-TEST01',
      relative_person_id: relPersonId,
      relative_email: relEmail,
      direct_link: true,
      relationship_type: 'SON',
      otp_token: childOtpToken,
      person: {
        first_name: 'Kiran',
        middle_name: 'Kumar',
        last_name: 'Murari',
        full_name: 'Kiran Kumar Murari',
        gender: 'Male',
        dob: '15/05/1995',
        email: childEmail,
        phone: '9876543210',
        otp_token: childOtpToken
      }
    }
  };

  const linkRes = await simulateExpressRequest(app, 'POST', '/api/requests', mockPayload);

  assert.equal(linkRes.status, 200);
  assert.equal(linkRes.json.success, true);
  assert.equal(linkRes.json.direct_linked, true);
  assert.ok(linkRes.json.member_ref_id);

  // Verify person exists in PERSONS with Approved status
  const allPersons = await sheetsClient.getRows(TABS.PERSONS);
  const created = allPersons.find(p => p.member_ref_id === linkRes.json.member_ref_id);
  assert.ok(created);
  assert.equal(created.status, 'Approved');
  assert.equal(created.first_name, 'Kiran');
});

test('Exception Request - When relative email is not verified, request is queued as Pending ticket for Admin', async () => {
  const sheetsClient = getSheetsClient();

  const childEmail = 'child.exception@example.com';
  await createAndSendOtp({
    email: childEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    overrideCode: '654321',
    sheetsClient
  });
  const verifyRes = await verifyOtp({
    email: childEmail,
    purpose: 'NEW_PERSON_EMAIL_VERIFICATION',
    code: '654321',
    sheetsClient
  });
  const childOtpToken = verifyRes.token;

  const mockPayload = {
    type: 'ADD_MEMBER',
    direct_link: false,
    requester_email: childEmail,
    otp_token: childOtpToken,
    payload: {
      surname_ref_id: 'FT-TEST01',
      relative_person_id: 'test-rel-p1',
      direct_link: false,
      relationship_type: 'DAUGHTER',
      otp_token: childOtpToken,
      person: {
        first_name: 'Priya',
        middle_name: '',
        last_name: 'Murari',
        full_name: 'Priya Murari',
        gender: 'Female',
        dob: '20/08/1998',
        email: childEmail,
        phone: '9876543211',
        otp_token: childOtpToken
      }
    }
  };

  const reqRes = await simulateExpressRequest(app, 'POST', '/api/requests', mockPayload);

  assert.equal(reqRes.status, 201);
  assert.equal(reqRes.json.success, true);
  assert.equal(reqRes.json.direct_linked, false);
  assert.ok(reqRes.json.ticket_id.startsWith('TKT-MEM-'));

  // Verify request is saved as Pending in REQUESTS
  const allRequests = await sheetsClient.getRows(TABS.REQUESTS);
  const reqRow = allRequests.find(r => r.ticket_id === reqRes.json.ticket_id);
  assert.ok(reqRow);
  assert.equal(reqRow.status, 'Pending');
});
