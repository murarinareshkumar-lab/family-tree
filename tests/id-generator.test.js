import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ID_ALPHABET,
  generateFamilyRefId,
  generateMemberRefId,
  computeNextBranchNo,
  normalizeSurnameLetters
} from '../lib/id-generator.js';

test('ID Alphabet - Exactly 31 characters, excludes 0, O, 1, I', () => {
  assert.strictEqual(ID_ALPHABET.length, 31);
  assert.strictEqual(ID_ALPHABET.includes('0'), false);
  assert.strictEqual(ID_ALPHABET.includes('O'), false);
  assert.strictEqual(ID_ALPHABET.includes('1'), false);
  assert.strictEqual(ID_ALPHABET.includes('I'), false);
  // Verify all uppercase letters and digits 2-9
  assert.match(ID_ALPHABET, /^[A-Z2-9]+$/);
});

test('Family Reference ID - Random, permanent FT-XXXXXX format', () => {
  const id1 = generateFamilyRefId();
  assert.match(id1, /^FT-[A-HJ-NP-Z2-9]{6}$/);
  assert.strictEqual(id1.length, 9);

  const id2 = generateFamilyRefId();
  assert.match(id2, /^FT-[A-HJ-NP-Z2-9]{6}$/);
  assert.notStrictEqual(id1, id2);
});

test('Family Reference ID - Collision avoidance against existing IDs (including Merged & Rejected)', () => {
  const existing = new Set(['FT-ABCDEF', 'FT-GHJKMN']);
  const generated = generateFamilyRefId(existing);
  assert.strictEqual(existing.has(generated), true); // Generator adds to set
  assert.notStrictEqual(generated, 'FT-ABCDEF');
  assert.notStrictEqual(generated, 'FT-GHJKMN');
});

test('Member Reference ID - Random, permanent FM-XXXXXXXX format', () => {
  const id1 = generateMemberRefId();
  assert.match(id1, /^FM-[A-HJ-NP-Z2-9]{8}$/);
  assert.strictEqual(id1.length, 11);

  // Does not contain family prefix and never reuses
  assert.strictEqual(id1.startsWith('FT-'), false);

  const id2 = generateMemberRefId();
  assert.notStrictEqual(id1, id2);
});

test('Member Reference ID - Collision avoidance against existing member IDs', () => {
  const existing = new Set(['FM-AAAAAAAA', 'FM-BBBBBBBB']);
  const generated = generateMemberRefId(existing);
  assert.strictEqual(existing.has(generated), true);
  assert.notStrictEqual(generated, 'FM-AAAAAAAA');
  assert.notStrictEqual(generated, 'FM-BBBBBBBB');
});

test('Branch Number Calculation - Increments for same surname_norm among Approved/Merged', () => {
  const allSurnames = [
    { surname_ref_id: 'FT-AAAAAA', surname_name: 'Murari', surname_norm: 'MURARI', branch_no: '1', status: 'Approved' },
    { surname_ref_id: 'FT-BBBBBB', surname_name: 'Murari', surname_norm: 'MURARI', branch_no: '2', status: 'Merged' },
    { surname_ref_id: 'FT-CCCCCC', surname_name: 'Murari', surname_norm: 'MURARI', branch_no: '3', status: 'Rejected' }, // Rejected ignored
    { surname_ref_id: 'FT-DDDDDD', surname_name: 'Patil', surname_norm: 'PATIL', branch_no: '1', status: 'Approved' } // Different surname
  ];

  // For Murari, highest approved/merged branch is 2 -> next is 3
  const nextMurari = computeNextBranchNo('Murari', allSurnames);
  assert.strictEqual(nextMurari, 3);

  // For Patil, highest is 1 -> next is 2
  const nextPatil = computeNextBranchNo('Patil', allSurnames);
  assert.strictEqual(nextPatil, 2);

  // For completely new surname, returns 1
  const nextSharma = computeNextBranchNo('Sharma', allSurnames);
  assert.strictEqual(nextSharma, 1);
});
