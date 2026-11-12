import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMemberDropdownLabel } from '../client/src/utils/memberDropdown.js';

test('Dropdown Label - Unique name shows only name without UCIC ID or technical tags', () => {
  const members = [
    { person_id: 'p1', member_ref_id: 'MU-GUR-011946-001', full_name: 'Gurubheema Murari', founding_role: 'HUSBAND', gender: 'MALE' },
    { person_id: 'p2', member_ref_id: 'MU-NEE-011951-001', full_name: 'Neeraja Murari', founding_role: 'WIFE', gender: 'FEMALE' }
  ];

  const label1 = formatMemberDropdownLabel(members[0], members);
  const label2 = formatMemberDropdownLabel(members[1], members);

  assert.equal(label1, 'Gurubheema Murari');
  assert.equal(label2, 'Neeraja Murari');
  assert.equal(label1.includes('MU-GUR'), false);
  assert.equal(label1.includes('HUSBAND'), false);
});

test('Dropdown Label - Similar names with spouse disambiguates with Husband of / Wife of', () => {
  const members = [
    {
      person_id: 'p1',
      member_ref_id: 'MU-RAM-011970-001',
      full_name: 'Ramesh Murari',
      gender: 'MALE',
      spouse_name: 'Sita Murari'
    },
    {
      person_id: 'p2',
      member_ref_id: 'MU-RAM-011995-002',
      full_name: 'Ramesh Murari',
      gender: 'MALE',
      father_name: 'Anand Murari'
    },
    {
      person_id: 'p3',
      member_ref_id: 'MU-ANI-011975-001',
      full_name: 'Anita Murari',
      gender: 'FEMALE',
      spouse_name: 'Suresh Murari'
    },
    {
      person_id: 'p4',
      member_ref_id: 'MU-ANI-012000-002',
      full_name: 'Anita Murari',
      gender: 'FEMALE',
      mother_name: 'Neeraja Murari'
    }
  ];

  // Ramesh 1 has spouse
  const labelRamesh1 = formatMemberDropdownLabel(members[0], members);
  assert.equal(labelRamesh1, 'Ramesh Murari (Husband of Sita Murari)');

  // Ramesh 2 has no spouse, but has father
  const labelRamesh2 = formatMemberDropdownLabel(members[1], members);
  assert.equal(labelRamesh2, 'Ramesh Murari (Son of Anand Murari)');

  // Anita 1 has spouse
  const labelAnita1 = formatMemberDropdownLabel(members[2], members);
  assert.equal(labelAnita1, 'Anita Murari (Wife of Suresh Murari)');

  // Anita 2 has no spouse, but has mother
  const labelAnita2 = formatMemberDropdownLabel(members[3], members);
  assert.equal(labelAnita2, 'Anita Murari (Daughter of Neeraja Murari)');

  // Ensure no UCIC ID in any label
  assert.equal(labelRamesh1.includes('MU-RAM'), false);
  assert.equal(labelRamesh2.includes('MU-RAM'), false);
  assert.equal(labelAnita1.includes('MU-ANI'), false);
  assert.equal(labelAnita2.includes('MU-ANI'), false);
});

test('Dropdown Label - Women with before marriage surname displays maiden surname', () => {
  const members = [
    {
      person_id: 'w1',
      member_ref_id: 'MU-NEE-011950-001',
      full_name: 'Neeraja Murari',
      gender: 'FEMALE',
      founding_role: 'WIFE',
      spouse_name: 'Gurubheema Murari',
      surname_before_marriage: 'Kulkarni'
    },
    {
      person_id: 'w2',
      member_ref_id: 'MU-NEE-011980-002',
      full_name: 'Neeraja Murari',
      gender: 'FEMALE',
      father_name: 'Ramesh Murari'
    }
  ];

  const labelWife = formatMemberDropdownLabel(members[0], members);
  assert.equal(labelWife, 'Neeraja Murari (Wife of Gurubheema Murari, Before Marriage: Kulkarni)');

  const labelDaughter = formatMemberDropdownLabel(members[1], members);
  assert.equal(labelDaughter, 'Neeraja Murari (Daughter of Ramesh Murari)');
});
