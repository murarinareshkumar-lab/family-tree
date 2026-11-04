import { getSheetsClient } from '../lib/sheets.js';
import { TABS } from '../lib/schema.js';
import { normalizeName, normalizeEmail } from '../lib/duplicates.js';

async function seed() {
  const sheets = getSheetsClient();
  await sheets.ensureTabsAndHeaders();
  const now = new Date().toISOString();
  await sheets.appendRow(TABS.SURNAMES, { surname_ref_id: 'PATFT', surname_name: 'Patil', status: 'Approved', last_seq: '2', created_at: now });
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'p1', member_ref_id: 'PATFT-0001', surname_ref_id: 'PATFT', full_name: 'Devendra Patil',
    name_norm: normalizeName('Devendra Patil'), gender: 'MALE', dob: '1970-01-01', is_deceased: 'false',
    email: 'devendra@example.com', email_norm: normalizeEmail('devendra@example.com'), phone: '9876543201',
    status: 'Approved', verified_by_admin: 'true', created_at: now
  });
  await sheets.appendRow(TABS.PERSONS, {
    person_id: 'p2', member_ref_id: 'PATFT-0002', surname_ref_id: 'PATFT', full_name: 'Saroj Patil',
    name_norm: normalizeName('Saroj Patil'), gender: 'FEMALE', dob: '1974-05-12', is_deceased: 'false',
    email: 'saroj@example.com', email_norm: normalizeEmail('saroj@example.com'), phone: '9876543202',
    status: 'Approved', verified_by_admin: 'true', created_at: now
  });
  await sheets.appendRow(TABS.RELATIONSHIPS, { rel_id: 'r1', person_a_id: 'p1', person_b_id: 'p2', type: 'SPOUSE_OF', status: 'Approved', created_at: now });
  await sheets.appendRow(TABS.RELATIONSHIPS, { rel_id: 'r2', person_a_id: 'p2', person_b_id: 'p1', type: 'SPOUSE_OF', status: 'Approved', created_at: now });
  console.log('Sample Patil family seeded.');
}
seed().catch(console.error);
