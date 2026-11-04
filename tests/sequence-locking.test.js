import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider } from '../lib/sheets.js';
import { createLockManager } from '../lib/lock.js';
import { formatMemberRefId } from '../lib/id-generator.js';
import { TABS } from '../lib/schema.js';

test('Member Sequence & Locking - Safe sequential assignment without reuse', async () => {
  const sheets = new InMemorySheetsProvider();
  const lockManager = createLockManager(sheets);
  const surnameRefId = 'PATFT';
  await sheets.appendRow(TABS.SURNAMES, {
    surname_ref_id: surnameRefId, surname_name: 'Patil', status: 'Approved', last_seq: '0', created_at: new Date().toISOString()
  });

  async function approveMemberAndAssignId(surnameId, personName) {
    const lock = await lockManager.acquire(`lock_member_seq_${surnameId}`, 5000);
    try {
      const surnames = await sheets.getRows(TABS.SURNAMES);
      const surnameRow = surnames.find(s => s.surname_ref_id === surnameId);
      const nextSeq = parseInt(surnameRow.last_seq || '0', 10) + 1;
      const memberRefId = formatMemberRefId(surnameId, nextSeq);
      await sheets.appendRow(TABS.PERSONS, {
        person_id: `uuid-${nextSeq}`, member_ref_id: memberRefId, surname_ref_id: surnameId, full_name: personName, status: 'Approved'
      });
      await sheets.updateRow(TABS.SURNAMES, surnameRow.__rowIndex, { last_seq: String(nextSeq) });
      return memberRefId;
    } finally {
      await lock.release();
    }
  }

  const id1 = await approveMemberAndAssignId(surnameRefId, 'Ramesh Patil');
  assert.strictEqual(id1, 'PATFT-0001');

  const id2 = await approveMemberAndAssignId(surnameRefId, 'Suresh Patil');
  assert.strictEqual(id2, 'PATFT-0002');

  const persons = await sheets.getRows(TABS.PERSONS);
  const p2 = persons.find(p => p.member_ref_id === 'PATFT-0002');
  await sheets.updateRow(TABS.PERSONS, p2.__rowIndex, { status: 'Rejected' });

  const id3 = await approveMemberAndAssignId(surnameRefId, 'Mahesh Patil');
  assert.strictEqual(id3, 'PATFT-0003');

  const allPersons = await sheets.getRows(TABS.PERSONS);
  assert.strictEqual(allPersons.length, 3);
  assert.strictEqual(allPersons.some(p => p.member_ref_id === 'PATFT-0002' && p.status === 'Rejected'), true);
});
