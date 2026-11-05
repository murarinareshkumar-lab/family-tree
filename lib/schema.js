export const TABS = {
  SURNAMES: 'FT_Surname_Details',
  PERSONS: 'FT_User_Details',
  RELATIONSHIPS: 'FT_Relationships',
  REQUESTS: 'FT_Requests',
  AUDIT_LOG: 'FT_Admin',
  META: 'FT_Admin_Meta'
};

export const HEADERS = {
  [TABS.SURNAMES]: ['surname_ref_id', 'surname_name', 'status', 'last_seq', 'created_at'],
  [TABS.PERSONS]: [
    'person_id', 'member_ref_id', 'surname_ref_id', 'full_name', 'name_norm',
    'gender', 'dob', 'is_deceased', 'email', 'email_norm', 'phone', 'phone_norm',
    'father_person_id', 'mother_person_id', 'status', 'merged_into_person_id',
    'verified_by_admin', 'created_at'
  ],
  [TABS.RELATIONSHIPS]: ['rel_id', 'person_a_id', 'person_b_id', 'type', 'status', 'created_at'],
  [TABS.REQUESTS]: [
    'ticket_id', 'type', 'payload_json', 'requester_email', 'status',
    'mail_verified', 'mail_verified_note', 'created_at', 'decided_at', 'admin_remarks'
  ],
  [TABS.AUDIT_LOG]: [
    'log_id', 'timestamp', 'admin', 'action', 'entity', 'entity_id',
    'previous_value', 'updated_value', 'ticket_id'
  ],
  [TABS.META]: ['key', 'value', 'updated_at', 'notes']
};

export const PLAIN_TEXT_COLUMNS = new Set([
  'surname_ref_id', 'person_id', 'member_ref_id', 'phone', 'phone_norm', 'dob',
  'ticket_id', 'rel_id', 'log_id', 'father_person_id', 'mother_person_id', 'merged_into_person_id'
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
