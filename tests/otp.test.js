import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider } from '../lib/sheets.js';
import {
  hashOtpCode,
  createAndSendOtp,
  verifyOtp,
  verifyVerificationToken
} from '../lib/otp.js';
import { TABS } from '../lib/schema.js';

test('OTP Module - Hash security: HMAC-SHA256, no plain text', () => {
  const hash1 = hashOtpCode('123456', 'user@example.com', 'ONBOARD_SURNAME');
  assert.strictEqual(typeof hash1, 'string');
  assert.strictEqual(hash1.length, 64); // SHA256 hex is 64 chars
  assert.strictEqual(hash1.includes('123456'), false);

  // Different code produces different hash
  const hash2 = hashOtpCode('654321', 'user@example.com', 'ONBOARD_SURNAME');
  assert.notStrictEqual(hash1, hash2);

  // Email normalization is applied
  const hashNormalized = hashOtpCode('123456', 'USER@EXAMPLE.COM', 'ONBOARD_SURNAME');
  assert.strictEqual(hash1, hashNormalized);
});

test('OTP Module - Creation, resend gap, and cancellation of older codes', async () => {
  const sheets = new InMemorySheetsProvider();
  const email = 'test@familytree.org';
  const purpose = 'ADD_MEMBER';

  // 1. Initial OTP send
  const result1 = await createAndSendOtp({
    email,
    purpose,
    sheetsClient: sheets
  });
  assert.strictEqual(result1.ok, true);
  assert.strictEqual(result1.resendAfterSeconds, 30);

  const rows1 = await sheets.getRows(TABS.OTP);
  assert.strictEqual(rows1.length, 1);
  assert.strictEqual(rows1[0].status, 'PENDING');
  assert.strictEqual(rows1[0].attempts, '0');
  assert.strictEqual(rows1[0].resends, '0');
  assert.ok(rows1[0].code_hash);

  // 2. Immediate resend fails with 30-second gap
  await assert.rejects(
    async () => {
      await createAndSendOtp({
        email,
        purpose,
        sheetsClient: sheets
      });
    },
    err => {
      assert.strictEqual(err.code, 'RESEND_GAP');
      assert.ok(err.resendAfterSeconds > 0);
      return true;
    }
  );

  // 3. Simulate passage of 31 seconds by modifying last_sent_at
  const simulatedTime = new Date(Date.now() - 31000).toISOString();
  await sheets.updateRow(TABS.OTP, 'otp_id', rows1[0].otp_id, {
    last_sent_at: simulatedTime
  });

  // Second send now succeeds
  const result2 = await createAndSendOtp({
    email,
    purpose,
    sheetsClient: sheets
  });
  assert.strictEqual(result2.ok, true);

  const rows2 = await sheets.getRows(TABS.OTP);
  assert.strictEqual(rows2.length, 2);

  // Previous code must be cancelled
  const previous = rows2.find(r => r.otp_id === rows1[0].otp_id);
  assert.strictEqual(previous.status, 'CANCELLED');

  const latest = rows2.find(r => r.otp_id === result2.otpId);
  assert.strictEqual(latest.status, 'PENDING');
  assert.strictEqual(latest.resends, '1');
});

test('OTP Module - Verification, attempt limits, and token issuance', async () => {
  const sheets = new InMemorySheetsProvider();
  const email = 'member@familytree.org';
  const purpose = 'JOIN_REQUEST';

  const actualCode = '456789';
  await createAndSendOtp({
    email,
    purpose,
    sheetsClient: sheets,
    overrideCode: actualCode
  });

  // Test incorrect code
  const fail1 = await verifyOtp({
    email,
    purpose,
    code: '000000',
    sheetsClient: sheets
  });
  assert.strictEqual(fail1.ok, false);
  assert.match(fail1.error, /4 attempts remaining/);

  // Check attempt increment in sheet
  let rows = await sheets.getRows(TABS.OTP);
  assert.strictEqual(rows[0].attempts, '1');

  // Verify with correct code
  const verifySuccess = await verifyOtp({
    email,
    purpose,
    code: actualCode,
    sheetsClient: sheets
  });
  assert.strictEqual(verifySuccess.ok, true);
  assert.strictEqual(verifySuccess.verified, true);
  assert.ok(verifySuccess.token, 'Must return signed verification token');

  // Token verification
  const checkToken = verifyVerificationToken(verifySuccess.token, purpose, email);
  assert.strictEqual(checkToken.valid, true);
  assert.strictEqual(checkToken.decoded.purpose, purpose);

  // Code cannot be reused (status is now VERIFIED)
  const reuseFail = await verifyOtp({
    email,
    purpose,
    code: actualCode,
    sheetsClient: sheets
  });
  assert.strictEqual(reuseFail.ok, false);
  assert.match(reuseFail.error, /No active verification code found/);
});

test('OTP Module - Maximum 5 attempts lockout', async () => {
  const sheets = new InMemorySheetsProvider();
  const email = 'locked@familytree.org';
  const purpose = 'EDIT_MEMBER';

  await createAndSendOtp({
    email,
    purpose,
    sheetsClient: sheets
  });

  for (let i = 1; i <= 4; i++) {
    const res = await verifyOtp({
      email,
      purpose,
      code: '999999',
      sheetsClient: sheets
    });
    assert.strictEqual(res.ok, false);
  }

  // 5th attempt triggers lockout
  const finalFail = await verifyOtp({
    email,
    purpose,
    code: '999999',
    sheetsClient: sheets
  });
  assert.strictEqual(finalFail.ok, false);
  assert.match(finalFail.error, /Maximum attempts exceeded/);

  const rows = await sheets.getRows(TABS.OTP);
  assert.strictEqual(rows[0].status, 'MAX_ATTEMPTS_EXCEEDED');
});
