export const TABS = {
  SURNAMES: 'FT_Surname_Details',
  PERSONS: 'FT_User_Details',
  RELATIONSHIPS: 'FT_Relationships',
  REQUESTS: 'FT_Requests',
  FAMILY_LINKS: 'FamilyLinks',
  OTP: 'Otp',
  AUDIT_LOG: 'FT_Admin',
  META: 'FT_Admin_Meta'
};

export const HEADERS = {
  [TABS.SURNAMES]: ['surname_ref_id', 'surname_name', 'surname_norm', 'branch_no', 'merged_into_surname_ref_id', 'status', 'last_seq', 'created_at'],
  [TABS.PERSONS]: [
    'person_id', 'member_ref_id', 'surname_ref_id', 'first_name', 'middle_name', 'last_name',
    'full_name', 'former_name', 'name_norm', 'gender', 'founding_role', 'dob', 'dob_precision',
    'is_deceased', 'date_of_death', 'marital_status', 'surname_before_marriage', 'surname_after_marriage',
    'occupation', 'location', 'email', 'email_norm', 'phone', 'phone_norm',
    'father_person_id', 'mother_person_id', 'status', 'merged_into_person_id',
    'verified_by_admin', 'photo_url', 'created_at'
  ],
  [TABS.RELATIONSHIPS]: ['rel_id', 'person_a_id', 'person_b_id', 'type', 'start_date', 'spouse_status', 'verified_by', 'status', 'created_at'],
  [TABS.FAMILY_LINKS]: [
    'link_id', 'link_type', 'family_a_ref_id', 'family_b_ref_id', 'person_a_id', 'person_b_id',
    'relation_note', 'ticket_id', 'status', 'created_at', 'decided_at', 'admin_remarks'
  ],
  [TABS.REQUESTS]: [
    'ticket_id', 'type', 'payload_json', 'requester_email', 'status',
    'mail_verified', 'mail_verified_note', 'second_party_email', 'second_party_mail_verified', 'second_party_mail_note',
    'phone_verified', 'phone_verified_by', 'phone_verified_at', 'phone_verified_note',
    'created_at', 'decided_at', 'admin_remarks'
  ],
  [TABS.OTP]: [
    'otp_id', 'purpose', 'email_norm', 'request_ref', 'code_hash',
    'expires_at', 'attempts', 'resends', 'last_sent_at', 'status'
  ],
  [TABS.AUDIT_LOG]: [
    'log_id', 'timestamp', 'admin', 'action', 'entity', 'entity_id',
    'previous_value', 'updated_value', 'ticket_id'
  ],
  [TABS.META]: ['key', 'value', 'updated_at', 'notes']
};

export const PLAIN_TEXT_COLUMNS = new Set([
  'surname_ref_id', 'person_id', 'member_ref_id', 'phone', 'phone_norm', 'dob', 'date_of_death',
  'dob_precision', 'marital_status', 'start_date', 'spouse_status', 'verified_by',
  'ticket_id', 'rel_id', 'link_id', 'family_a_ref_id', 'family_b_ref_id', 'person_a_id', 'person_b_id',
  'merged_into_surname_ref_id', 'merged_into_person_id', 'log_id', 'father_person_id', 'mother_person_id',
  'founding_role', 'former_name', 'branch_no', 'otp_id', 'code_hash', 'request_ref', 'email_norm'
]);

export function createHeaderMap(headerRow = []) {
  const map = new Map();
  headerRow.forEach((col, index) => {
    if (typeof col === 'string' && col.trim()) {
      map.set(col.trim(), index);
    }
  });
  return map;
}

export function rowToObject(rowArray = [], headerMap) {
  const obj = {};
  for (const [header, index] of headerMap.entries()) {
    obj[header] = rowArray[index] !== undefined ? String(rowArray[index]) : '';
  }
  return obj;
}

export function objectToRow(obj = {}, headerList = []) {
  return headerList.map(header => {
    const val = obj[header];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}
