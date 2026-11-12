import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptPii,
  decryptPii,
  encryptRowPii,
  decryptRowPii,
  PII_COLUMNS
} from '../lib/crypto-pii.js';
import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';

test('PII GCM-256 - encryptPii produces enc:gcm:v1 prefix and authenticates on decrypt', () => {
  const plainEmail = 'test.user@murari.org';
  const encrypted = encryptPii(plainEmail);

  // Must have enc:gcm:v1 prefix and 6 parts
  assert.ok(encrypted.startsWith('enc:gcm:v1:'));
  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 6);
  assert.notStrictEqual(encrypted, plainEmail);

  // Decryption recovers exact plain text
  const decrypted = decryptPii(encrypted);
  assert.strictEqual(decrypted, plainEmail);
});

test('PII GCM-256 - Unique IV per encryption (non-deterministic ciphertexts)', () => {
  const phone = '9876543210';
  const enc1 = encryptPii(phone);
  const enc2 = encryptPii(phone);

  assert.notStrictEqual(enc1, enc2);
  assert.strictEqual(decryptPii(enc1), phone);
  assert.strictEqual(decryptPii(enc2), phone);
});

test('PII GCM-256 - Edge cases: empty strings, null, undefined, and non-double-encrypting', () => {
  assert.strictEqual(encryptPii(''), '');
  assert.strictEqual(encryptPii(null), '');
  assert.strictEqual(encryptPii(undefined), '');
  assert.strictEqual(decryptPii(''), '');
  assert.strictEqual(decryptPii(null), '');

  // Already encrypted string does not get double-encrypted
  const plain = 'secret-data';
  const enc = encryptPii(plain);
  const encDouble = encryptPii(enc);
  assert.strictEqual(enc, encDouble);
  assert.strictEqual(decryptPii(encDouble), plain);
});

test('PII GCM-256 - Backward compatibility with plain text and legacy base64', () => {
  // Existing unencrypted database records return untouched
  const legacyPlain = 'existing.plain@example.com';
  assert.strictEqual(decryptPii(legacyPlain), legacyPlain);

  const legacyPhone = '9876543210';
  assert.strictEqual(decryptPii(legacyPhone), legacyPhone);

  // Legacy b64: prefix decodes correctly
  const b64Val = `b64:${Buffer.from('legacy-b64-email@example.com').toString('base64')}`;
  assert.strictEqual(decryptPii(b64Val), 'legacy-b64-email@example.com');
});

test('PII GCM-256 - Row-level encryption and decryption across PII_COLUMNS', () => {
  const row = {
    person_id: 'p-1234',
    full_name: 'Gurubheema Murari',
    email: 'guru@murari.org',
    email_norm: 'guru@murari.org',
    phone: '9876543210',
    phone_norm: '9876543210',
    dob: '1946-01-01',
    location: 'Bangalore, India',
    occupation: 'Teacher',
    status: 'Approved'
  };

  const encryptedRow = encryptRowPii(row);

  // Non-PII fields remain plain text
  assert.strictEqual(encryptedRow.person_id, 'p-1234');
  assert.strictEqual(encryptedRow.full_name, 'Gurubheema Murari');
  assert.strictEqual(encryptedRow.status, 'Approved');

  // PII fields are encrypted with GCM
  for (const col of ['email', 'email_norm', 'phone', 'phone_norm', 'dob', 'location', 'occupation']) {
    assert.ok(encryptedRow[col].startsWith('enc:gcm:v1:'));
  }

  // Decryption recovers full original row
  const decryptedRow = decryptRowPii(encryptedRow);
  for (const [k, v] of Object.entries(row)) {
    assert.strictEqual(decryptedRow[k], v);
  }
});

test('PII GCM-256 - SheetsProvider transparent encryption on write and decryption on read', async () => {
  const sheets = getSheetsClient();

  const testPerson = {
    person_id: 'gcm-test-p1',
    member_ref_id: 'MU-TEST-011950-001',
    surname_ref_id: 'FT-TEST01',
    first_name: 'Test',
    last_name: 'Murari',
    full_name: 'Test Murari',
    gender: 'MALE',
    email: 'secure.gcm@example.com',
    email_norm: 'secure.gcm@example.com',
    phone: '9123456789',
    phone_norm: '9123456789',
    dob: '1950-01-01',
    status: 'Approved'
  };

  await sheets.appendRow(TABS.PERSONS, testPerson);

  // In internal storage, PII columns are encrypted with GCM
  if (sheets.sheets && sheets.sheets[TABS.PERSONS]) {
    const rawStored = sheets.sheets[TABS.PERSONS].rows.find(r => r.person_id === 'gcm-test-p1');
    assert.ok(rawStored);
    assert.ok(rawStored.email.startsWith('enc:gcm:v1:'));
    assert.ok(rawStored.phone.startsWith('enc:gcm:v1:'));
  }

  // On getRows(), PII columns are automatically decrypted
  const rows = await sheets.getRows(TABS.PERSONS);
  const retrieved = rows.find(r => r.person_id === 'gcm-test-p1');
  assert.ok(retrieved);
  assert.strictEqual(retrieved.email, 'secure.gcm@example.com');
  assert.strictEqual(retrieved.phone, '9123456789');
  assert.strictEqual(retrieved.dob, '1950-01-01');
});
