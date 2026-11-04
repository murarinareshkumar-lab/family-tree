import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, normalizePhone, normalizeName } from '../lib/duplicates.js';
import { normalizeUnicode } from '../lib/security.js';

test('Email Normalization - Gmail dots and +tags', () => {
  assert.strictEqual(normalizeEmail('John.Doe@gmail.com'), 'johndoe@gmail.com');
  assert.strictEqual(normalizeEmail('john.doe+familytree@gmail.com'), 'johndoe@gmail.com');
  assert.strictEqual(normalizeEmail('Jane.M.Doe+test.123@googlemail.com'), 'janemdoe@gmail.com');
  assert.strictEqual(normalizeEmail('user.name+tag@customdomain.com'), 'user.name@customdomain.com');
});

test('Phone Normalization - Indian mobile format (+91 stripped, digits only)', () => {
  assert.strictEqual(normalizePhone('+91 98765 43210'), '9876543210');
  assert.strictEqual(normalizePhone('+91-9876543210'), '9876543210');
  assert.strictEqual(normalizePhone('09876543210'), '9876543210');
  assert.strictEqual(normalizePhone('(987) 654-3210'), '9876543210');
  assert.strictEqual(normalizePhone('9876543210'), '9876543210');
});

test('Name Normalization - Unicode NFKC & script support', () => {
  assert.strictEqual(normalizeName('  Ramesh   Kumar  '), 'ramesh kumar');
  assert.strictEqual(normalizeUnicode('???? ?????'), '???? ?????');
  assert.strictEqual(normalizeUnicode('?????? ??????'), '?????? ??????');
  assert.strictEqual(normalizeUnicode('????? ????'), '????? ????');
});
