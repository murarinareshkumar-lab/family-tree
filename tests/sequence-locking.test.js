import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySheetsProvider } from '../lib/sheets.js';
import { createLockManager } from '../lib/lock.js';
import { generateMemberRefId, generateFamilyRefId } from '../lib/id-generator.js';
import { TABS } from '../lib/schema.js';

test('ID Locking & Collision Handling - Safe ID assignment under ID_LOCK checking all states', async () => {
  const sheets = new InMemorySheetsProvider();
  const lockManager = createLockManager(sheets);

  const familyRefId = generateFamilyRefId();
  await sheets.appendRow(TABS.SURNAMES, {
    surname_ref_id: familyRefId,
    surname_name: 'Patil',
    status: 'Approved',
    created_at: new Date().toISOString()
  });

  async function approveMemberAndAssignRandomId(surnameId, personName, forcedCandidate = null) {
    // Acquire ID_LOCK in Meta
    const lock = await lockManager.acquire('ID_LOCK', 5000);
    try {
      const curPersons = await sheets.getRows(TABS.PERSONS);
      const allUsedMemberIds = new Set(curPersons.map(p => String(p.member_ref_id || '').toUpperCase()));

      // If a candidate collision was simulated, check that it avoids collision
      let memberRefId;
      if (forcedCandidate && allUsedMemberIds.has(forcedCandidate.toUpperCase())) {
        // Must regenerate because candidate exists
        memberRefId = generateMemberRefId(allUsedMemberIds);
      } else if (forcedCandidate) {
        memberRefId = forcedCandidate;
      } else {
        memberRefId = generateMemberRefId(allUsedMemberIds);
      }

      await sheets.appendRow(TABS.PERSONS, {
        person_id: `uuid-${Date.now()}-${Math.random()}`,
        member_ref_id: memberRefId,
        surname_ref_id: surnameId,
        full_name: personName,
        status: 'Approved'
      });
      return memberRefId;
    } finally {
      await lock.release();
    }
  }

  const id1 = await approveMemberAndAssignRandomId(familyRefId, 'Ramesh Patil');
  assert.match(id1, /^FM-[A-HJ-NP-Z2-9]{8}$/);

  const id2 = await approveMemberAndAssignRandomId(familyRefId, 'Suresh Patil');
  assert.match(id2, /^FM-[A-HJ-NP-Z2-9]{8}$/);
  assert.notStrictEqual(id1, id2);

  // Mark Suresh as Rejected
  const persons = await sheets.getRows(TABS.PERSONS);
  const p2 = persons.find(p => p.member_ref_id === id2);
  await sheets.updateRow(TABS.PERSONS, p2.__rowIndex, { status: 'Rejected' });

  // Simulate collision attempt with id2 (which is Rejected): ID_LOCK check must reject id2 and generate a different unique ID
  const id3 = await approveMemberAndAssignRandomId(familyRefId, 'Mahesh Patil', id2);
  assert.match(id3, /^FM-[A-HJ-NP-Z2-9]{8}$/);
  assert.notStrictEqual(id3, id2); // Never reuse Rejected ID

  const allPersons = await sheets.getRows(TABS.PERSONS);
  assert.strictEqual(allPersons.length, 3);
  assert.strictEqual(allPersons.some(p => p.member_ref_id === id2 && p.status === 'Rejected'), true);
});
