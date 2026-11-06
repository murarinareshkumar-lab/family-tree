import test from 'node:test';
import assert from 'node:assert/strict';
import {
  whitelistPublicMember,
  whitelistPublicTreeNode,
  whitelistPublicSearchResult,
  sanitizeFormula,
  sanitizeObject
} from '../lib/security.js';

function assertNoForbiddenFields(obj, path = 'root') {
  const forbiddenKeyPatterns = [
    /gender/i,
    /ref_id/i,
    /member_ref/i,
    /surname_ref/i,
    /person_id/i,
    /dob/i,
    /email/i,
    /phone/i,
    /status/i,
    /notes/i,
    /deceased/i,
    /founding_role/i
  ];

  const forbiddenValuePatterns = [
    /^FT-[A-Z0-9]{6}$/i,
    /^FM-[A-Z0-9]{8}$/i,
    /[A-Z]+FT-\d+/i
  ];

  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      for (const pattern of forbiddenValuePatterns) {
        assert.equal(
          pattern.test(obj),
          false,
          `Forbidden reference ID value pattern ${pattern} found at ${path}: "${obj}"`
        );
      }
    }
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`;
    for (const pattern of forbiddenKeyPatterns) {
      assert.equal(
        pattern.test(key),
        false,
        `Forbidden private key pattern ${pattern} found at ${currentPath}`
      );
    }
    assertNoForbiddenFields(val, currentPath);
  }
}

test('Public Whitelist - Returns names only and throwaway id, zero private fields', () => {
  const sensitiveRecord = {
    person_id: 'uuid-1234',
    member_ref_id: 'PATFT-0001',
    surname_ref_id: 'PATFT',
    full_name: 'Devendra Patil',
    name_norm: 'devendra patil',
    former_name: 'Devu',
    gender: 'MALE',
    dob: '1980-04-15',
    is_deceased: false,
    email: 'devendra.patil@example.com',
    email_norm: 'devendrapatil@example.com',
    phone: '+91 9876543210',
    phone_norm: '9876543210',
    father_person_id: 'uuid-dad',
    mother_person_id: 'uuid-mom',
    status: 'Approved',
    verified_by_admin: 'true',
    created_at: '2026-01-01T00:00:00Z',
    secret_notes: 'Private family dispute notes'
  };

  const safeView = whitelistPublicMember(sensitiveRecord);

  // Assert allowed fields
  assert.equal(typeof safeView.id, 'string');
  assert.equal(safeView.id.startsWith('node_'), true);
  assert.equal(safeView.display_name, 'Devendra Patil (née Devu)');

  // Assert forbidden fields are absent
  assert.equal(safeView.member_ref_id, undefined);
  assert.equal(safeView.person_id, undefined);
  assert.equal(safeView.surname_ref_id, undefined);
  assert.equal(safeView.gender, undefined);
  assert.equal(safeView.dob, undefined);
  assert.equal(safeView.email, undefined);
  assert.equal(safeView.phone, undefined);
  assert.equal(safeView.status, undefined);
  assert.equal(safeView.notes, undefined);

  assertNoForbiddenFields(safeView);
});

test('Public Whitelist - Tree node safely sanitizes nested spouses and children', () => {
  const treeNode = {
    person_id: 'p1',
    member_ref_id: 'PATFT-0001',
    full_name: 'Grandfather Patil',
    gender: 'Male',
    email: 'secret@patil.com',
    phone: '9999999999',
    dob: '1945-01-01',
    status: 'Approved',
    admin_notes: 'Some internal notes',
    spouses: [
      {
        person_id: 'p2',
        member_ref_id: 'PATFT-0002',
        full_name: 'Grandmother Patil',
        gender: 'Female',
        email: 'secret2@patil.com',
        phone: '8888888888',
        status: 'Approved'
      }
    ],
    children: [
      {
        person_id: 'p3',
        member_ref_id: 'PATFT-0003',
        full_name: 'Father Patil',
        gender: 'Male',
        email: 'father@patil.com',
        dob: '1970-01-01',
        status: 'Approved',
        spouses: [
          {
            person_id: 'p4',
            member_ref_id: 'PATFT-0004',
            full_name: 'Mother Patil',
            gender: 'Female',
            email: 'mother@patil.com'
          }
        ],
        children: [
          {
            person_id: 'p5',
            member_ref_id: 'PATFT-0005',
            full_name: 'Child Patil',
            gender: 'Male',
            dob: '2005-01-01'
          }
        ]
      }
    ]
  };

  const safeTree = whitelistPublicTreeNode(treeNode);

  // Validate root
  assert.equal(typeof safeTree.id, 'string');
  assert.equal(safeTree.display_name, 'Grandfather Patil');

  // Validate spouses
  assert.equal(safeTree.spouses.length, 1);
  assert.equal(safeTree.spouses[0].display_name, 'Grandmother Patil');
  assert.equal(typeof safeTree.spouses[0].id, 'string');

  // Validate children
  assert.equal(safeTree.children.length, 1);
  assert.equal(safeTree.children[0].display_name, 'Father Patil');
  assert.equal(safeTree.children[0].spouses[0].display_name, 'Mother Patil');
  assert.equal(safeTree.children[0].children[0].display_name, 'Child Patil');

  // Strict recursive verification across all nested levels
  assertNoForbiddenFields(safeTree);
});

test('Public Whitelist - Search result returns name only', () => {
  const result = whitelistPublicSearchResult({
    full_name: 'Suresh Patil',
    member_ref_id: 'PATFT-0001',
    gender: 'Male',
    email: 'test@example.com'
  });
  assert.deepEqual(result, { name: 'Suresh Patil' });
  assertNoForbiddenFields(result);
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
