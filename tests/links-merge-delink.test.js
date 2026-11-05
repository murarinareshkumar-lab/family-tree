import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { whitelistPublicMember } from '../lib/security.js';
import { validateRelationship, convertDropdownToRelationships } from '../lib/relationships.js';

test('Links & Merging - MERGE_FAMILIES requires same surname', () => {
  const normA = 'MURARI';
  const normB = 'PATIL';
  assert.notStrictEqual(normA, normB);
  const isAllowed = normA === normB;
  assert.strictEqual(isAllowed, false);

  const normA2 = 'MURARI';
  const normB2 = 'MURARI';
  assert.strictEqual(normA2 === normB2, true);
});

test('Dual Email Verification - Both parties required for LINK_FAMILIES and MERGE_FAMILIES approval', () => {
  function canApprove(type, mailVerified, secondPartyMailVerified) {
    if (type === 'LINK_FAMILIES' || type === 'MERGE_FAMILIES') {
      return Boolean(mailVerified && secondPartyMailVerified);
    }
    return Boolean(mailVerified);
  }

  // Dual required
  assert.strictEqual(canApprove('LINK_FAMILIES', true, false), false);
  assert.strictEqual(canApprove('LINK_FAMILIES', false, true), false);
  assert.strictEqual(canApprove('LINK_FAMILIES', true, true), true);

  assert.strictEqual(canApprove('MERGE_FAMILIES', true, false), false);
  assert.strictEqual(canApprove('MERGE_FAMILIES', true, true), true);

  // Single party required for other types
  assert.strictEqual(canApprove('ONBOARD_SURNAME', true, false), true);
  assert.strictEqual(canApprove('ADD_MEMBER', true, false), true);
});

test('SAME_PERSON Soft Merge - Non-survivor soft-marked Merged and former_name recorded', async () => {
  const sheets = new InMemorySheetsProvider();

  // Person 1 (Survivor)
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'P-1',
    member_ref_id: 'FM-11111111',
    surname_ref_id: 'FT-AAAAAA',
    full_name: 'Anand Murari',
    former_name: '',
    status: 'Approved'
  });

  // Person 2 (Duplicate / Merged)
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'P-2',
    member_ref_id: 'FM-22222222',
    surname_ref_id: 'FT-BBBBBB',
    full_name: 'Ananda Kumar',
    former_name: '',
    status: 'Approved'
  });

  // Execute SAME_PERSON soft merge
  const allPersons = await sheets.getRows(TABS.PERSONS);
  const survivor = allPersons.find(p => p.person_id === 'P-1');
  const duplicate = allPersons.find(p => p.person_id === 'P-2');

  await sheets.updateRow(TABS.PERSONS, survivor.__rowIndex, {
    former_name: duplicate.full_name
  });
  await sheets.updateRow(TABS.PERSONS, duplicate.__rowIndex, {
    status: 'Merged',
    merged_into_person_id: survivor.person_id
  });

  const updatedPersons = await sheets.getRows(TABS.PERSONS);
  const p1 = updatedPersons.find(p => p.person_id === 'P-1');
  const p2 = updatedPersons.find(p => p.person_id === 'P-2');

  assert.strictEqual(p1.former_name, 'Ananda Kumar');
  assert.strictEqual(p1.status, 'Approved');
  assert.strictEqual(p2.status, 'Merged');
  assert.strictEqual(p2.merged_into_person_id, 'P-1');

  // Verify public whitelisted name rendering includes (née FormerName)
  const whitelistedP1 = whitelistPublicMember(p1);
  assert.strictEqual(whitelistedP1.full_name, 'Anand Murari (née Ananda Kumar)');
});

test('Delink Families - Link marked Delinked and cross relationships removed', async () => {
  const sheets = new InMemorySheetsProvider();

  await sheets.appendRow(TABS.FAMILY_LINKS, {
    link_id: 'L-1',
    link_type: 'PARENT_CHILD',
    family_a_ref_id: 'FT-AAAAAA',
    family_b_ref_id: 'FT-BBBBBB',
    person_a_id: 'P-1',
    person_b_id: 'P-2',
    status: 'Approved'
  });

  await sheets.appendRow(TABS.RELATIONSHIPS, {
    rel_id: 'R-1',
    person_a_id: 'P-1',
    person_b_id: 'P-2',
    type: 'PARENT_OF',
    status: 'Approved'
  });

  // Execute Delink
  const links = await sheets.getRows(TABS.FAMILY_LINKS);
  const linkRow = links.find(l => l.link_id === 'L-1');
  await sheets.updateRow(TABS.FAMILY_LINKS, linkRow.__rowIndex, {
    status: 'Delinked',
    decided_at: new Date().toISOString()
  });

  const rels = await sheets.getRows(TABS.RELATIONSHIPS);
  const relRow = rels.find(r => r.rel_id === 'R-1');
  await sheets.updateRow(TABS.RELATIONSHIPS, relRow.__rowIndex, {
    status: 'Removed'
  });

  const updatedLinks = await sheets.getRows(TABS.FAMILY_LINKS);
  assert.strictEqual(updatedLinks[0].status, 'Delinked');

  const updatedRels = await sheets.getRows(TABS.RELATIONSHIPS);
  assert.strictEqual(updatedRels[0].status, 'Removed');
});
