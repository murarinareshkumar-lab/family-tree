import { getSheetsClient } from '../lib/sheets.js';
import { generateSurnameRefId, generateMemberRefId } from '../lib/id-generator.js';

async function seed() {
  console.log('Seeding demo Patil family data...');
  const sheets = getSheetsClient();
  await sheets.initSchema();

  // 1. Create Surname
  const surnameRefId = generateSurnameRefId('Patil', new Set());
  const now = new Date().toISOString();
  await sheets.appendRow('Surnames', {
    surname_ref_id: surnameRefId,
    surname_name: 'Patil',
    status: 'Approved',
    last_seq: 4,
    created_at: now
  });

  // 2. Create Husband & Wife
  const rameshId = 'p_ramesh_001';
  const sunitaId = 'p_sunita_002';
  const anandId = 'p_anand_003';
  const priyaId = 'p_priya_004';

  await sheets.appendRow('Persons', {
    person_id: rameshId,
    member_ref_id: `${surnameRefId}-0001`,
    surname_ref_id: surnameRefId,
    full_name: 'Ramesh Patil',
    name_norm: 'ramesh patil',
    gender: 'Male',
    dob: '1965-04-12',
    is_deceased: false,
    email: 'ramesh.patil@example.com',
    email_norm: 'rameshpatil@example.com',
    phone: '9876543210',
    phone_norm: '9876543210',
    father_person_id: '',
    mother_person_id: '',
    status: 'Approved',
    merged_into_person_id: '',
    verified_by_admin: true,
    created_at: now
  });

  await sheets.appendRow('Persons', {
    person_id: sunitaId,
    member_ref_id: `${surnameRefId}-0002`,
    surname_ref_id: surnameRefId,
    full_name: 'Sunita Patil',
    name_norm: 'sunita patil',
    gender: 'Female',
    dob: '1968-08-20',
    is_deceased: false,
    email: 'sunita.patil@example.com',
    email_norm: 'sunitapatil@example.com',
    phone: '9876543211',
    phone_norm: '9876543211',
    father_person_id: '',
    mother_person_id: '',
    status: 'Approved',
    merged_into_person_id: '',
    verified_by_admin: true,
    created_at: now
  });

  // 3. Children
  await sheets.appendRow('Persons', {
    person_id: anandId,
    member_ref_id: `${surnameRefId}-0003`,
    surname_ref_id: surnameRefId,
    full_name: 'Anand Patil',
    name_norm: 'anand patil',
    gender: 'Male',
    dob: '1992-01-15',
    is_deceased: false,
    email: 'anand.patil@example.com',
    email_norm: 'anandpatil@example.com',
    phone: '9876543212',
    phone_norm: '9876543212',
    father_person_id: rameshId,
    mother_person_id: sunitaId,
    status: 'Approved',
    merged_into_person_id: '',
    verified_by_admin: true,
    created_at: now
  });

  await sheets.appendRow('Persons', {
    person_id: priyaId,
    member_ref_id: `${surnameRefId}-0004`,
    surname_ref_id: surnameRefId,
    full_name: 'Priya Patil',
    name_norm: 'priya patil',
    gender: 'Female',
    dob: '1995-11-05',
    is_deceased: false,
    email: 'priya.patil@example.com',
    email_norm: 'priyapatil@example.com',
    phone: '9876543213',
    phone_norm: '9876543213',
    father_person_id: rameshId,
    mother_person_id: sunitaId,
    status: 'Approved',
    merged_into_person_id: '',
    verified_by_admin: true,
    created_at: now
  });

  // 4. Relationships
  await sheets.appendRow('Relationships', {
    rel_id: 'rel_001',
    person_a_id: rameshId,
    person_b_id: sunitaId,
    type: 'SPOUSE_OF',
    status: 'Approved',
    created_at: now
  });
  await sheets.appendRow('Relationships', {
    rel_id: 'rel_002',
    person_a_id: sunitaId,
    person_b_id: rameshId,
    type: 'SPOUSE_OF',
    status: 'Approved',
    created_at: now
  });

  await sheets.appendRow('Relationships', {
    rel_id: 'rel_003',
    person_a_id: rameshId,
    person_b_id: anandId,
    type: 'PARENT_OF',
    status: 'Approved',
    created_at: now
  });
  await sheets.appendRow('Relationships', {
    rel_id: 'rel_004',
    person_a_id: sunitaId,
    person_b_id: anandId,
    type: 'PARENT_OF',
    status: 'Approved',
    created_at: now
  });

  await sheets.appendRow('Relationships', {
    rel_id: 'rel_005',
    person_a_id: rameshId,
    person_b_id: priyaId,
    type: 'PARENT_OF',
    status: 'Approved',
    created_at: now
  });
  await sheets.appendRow('Relationships', {
    rel_id: 'rel_006',
    person_a_id: sunitaId,
    person_b_id: priyaId,
    type: 'PARENT_OF',
    status: 'Approved',
    created_at: now
  });

  console.log('Seeded demo family successfully!');
}

seed().catch(console.error);
