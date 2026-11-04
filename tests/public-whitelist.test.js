import test from 'node:test';
import assert from 'node:assert/strict';
import { whitelistPublicMember, whitelistPublicTreeNode, sanitizeFormula, sanitizeObject } from '../lib/security.js';

test('Public Whitelist - Strictly hides email, phone, DOB, and private metadata', () => {
  const sensitiveRecord = {
    person_id: 'uuid-1234', member_ref_id: 'PATFT-0001', surname_ref_id: 'PATFT',
    full_name: 'Devendra Patil', name_norm: 'devendra patil', gender: 'MALE', dob: '1980-04-15',
    is_deceased: false, email: 'devendra.patil@example.com', email_norm: 'devendrapatil@example.com',
    phone: '+91 9876543210', phone_norm: '9876543210', father_person_id: 'uuid-dad',
    mother_person_id: 'uuid-mom', status: 'Approved', verified_by_admin: 'true',
    created_at: '2026-01-01T00:00:00Z', secret_notes: 'Private family dispute notes'
  };
  const safeView = whitelistPublicMember(sensitiveRecord);
  assert.strictEqual(safeView.person_id, 'uuid-1234');
  assert.strictEqual(safeView.member_ref_id, 'PATFT-0001');
  assert.strictEqual(safeView.display_name, 'Devendra Patil');
  assert.strictEqual(safeView.gender, 'MALE');
  assert.strictEqual(safeView.is_deceased, false);
  assert.strictEqual(safeView.email, undefined);
  assert.strictEqual(safeView.email_norm, undefined);
  assert.strictEqual(safeView.phone, undefined);
  assert.strictEqual(safeView.phone_norm, undefined);
  assert.strictEqual(safeView.dob, undefined);
  assert.strictEqual(safeView.father_person_id, undefined);
  assert.strictEqual(safeView.mother_person_id, undefined);
  assert.strictEqual(safeView.verified_by_admin, undefined);
  assert.strictEqual(safeView.secret_notes, undefined);
});

test('Public Whitelist - Tree node safely sanitizes nested spouses and children', () => {
  const treeNode = {
    person_id: 'p1', member_ref_id: 'PATFT-0001', full_name: 'Grandfather Patil',
    email: 'secret@patil.com', phone: '9999999999', dob: '1945-01-01',
    spouses: [{ person_id: 'p2', member_ref_id: 'PATFT-0002', full_name: 'Grandmother Patil', email: 'secret2@patil.com', phone: '8888888888' }],
    children: [{ person_id: 'p3', member_ref_id: 'PATFT-0003', full_name: 'Father Patil', email: 'father@patil.com', dob: '1970-01-01', children: [] }]
  };
  const safeTree = whitelistPublicTreeNode(treeNode);
  assert.strictEqual(safeTree.display_name, 'Grandfather Patil');
  assert.strictEqual(safeTree.email, undefined);
  assert.strictEqual(safeTree.spouses[0].display_name, 'Grandmother Patil');
  assert.strictEqual(safeTree.spouses[0].email, undefined);
  assert.strictEqual(safeTree.children[0].display_name, 'Father Patil');
  assert.strictEqual(safeTree.children[0].email, undefined);
});

test('Formula Injection Sanitization - Strips leading = + - @ \t \r', () => {
  assert.strictEqual(sanitizeFormula('=cmd|"/C calc"!A0'), 'cmd|"/C calc"!A0');
  assert.strictEqual(sanitizeFormula('+SUM(A1:A10)'), 'SUM(A1:A10)');
  assert.strictEqual(sanitizeFormula('-123+456'), '123+456');
  assert.strictEqual(sanitizeFormula('@SUM(B1)'), 'SUM(B1)');
  assert.strictEqual(sanitizeFormula('\t=HYPERLINK("http://evil.com")'), 'HYPERLINK("http://evil.com")');
  assert.strictEqual(sanitizeFormula('Normal Name'), 'Normal Name');

  const obj = { name: '  =InjectedName  ', comment: '+100 bonus', nested: { field: '@Dangerous' } };
  const sanitized = sanitizeObject(obj);
  assert.strictEqual(sanitized.name, 'InjectedName');
  assert.strictEqual(sanitized.comment, '100 bonus');
  assert.strictEqual(sanitized.nested.field, 'Dangerous');
});
