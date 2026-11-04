import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSurnameRefId, formatMemberRefId } from '../lib/id-generator.js';

test('Surname ID Generation - Standard Case', () => {
  const id = generateSurnameRefId('Patil', new Set());
  assert.strictEqual(id, 'PATFT');
});

test('Surname ID Generation - Conflict Resolution with Increasing N', () => {
  const existing = new Set(['PATFT']);
  const id2 = generateSurnameRefId('Patil', existing);
  assert.strictEqual(id2, 'PATIFT');

  const existing2 = new Set(['PATFT', 'PATIFT']);
  const id3 = generateSurnameRefId('Patil', existing2);
  assert.strictEqual(id3, 'PATILFT');
});

test('Surname ID Generation - Short Surname (< 3 letters) padded with X', () => {
  const raId = generateSurnameRefId('Ra', new Set());
  assert.strictEqual(raId, 'RAXFT');
  const oId = generateSurnameRefId('O', new Set());
  assert.strictEqual(oId, 'OXXFT');
  const raExisting = new Set(['RAXFT']);
  const raId2 = generateSurnameRefId('Ra', raExisting);
  assert.strictEqual(raId2, 'RAXFT2');
});

test('Surname ID Generation - Numeric Fallback when all candidates up to full length conflict', () => {
  const existing = new Set(['PATFT', 'PATIFT', 'PATILFT']);
  const id = generateSurnameRefId('Patil', existing);
  assert.strictEqual(id, 'PATILFT2');
  const existingWith2 = new Set(['PATFT', 'PATIFT', 'PATILFT', 'PATILFT2']);
  const id2 = generateSurnameRefId('Patil', existingWith2);
  assert.strictEqual(id2, 'PATILFT3');
});

test('Surname ID Generation - Handles Special Characters & Apostrophes', () => {
  const id = generateSurnameRefId("O'Connor", new Set());
  assert.strictEqual(id, 'OCOFT');
  const id2 = generateSurnameRefId('De Souza', new Set());
  assert.strictEqual(id2, 'DESFT');
});

test('Member ID Format - Sequential per surname', () => {
  assert.strictEqual(formatMemberRefId('PATFT', 1), 'PATFT-0001');
  assert.strictEqual(formatMemberRefId('PATFT', 42), 'PATFT-0042');
  assert.strictEqual(formatMemberRefId('RAXFT', 999), 'RAXFT-0999');
  assert.strictEqual(formatMemberRefId('PATILFT2', 1000), 'PATILFT2-1000');
});
