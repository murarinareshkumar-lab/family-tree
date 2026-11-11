import { normalizeUnicode } from './security.js';

export function normalizeName(name) {
  if (!name) return '';
  return normalizeUnicode(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function normalizeEmail(email) {
  if (!email) return '';
  const trimmed = String(email).trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return trimmed;

  let localPart = trimmed.slice(0, atIndex);
  let domainPart = trimmed.slice(atIndex + 1);

  if (domainPart === 'googlemail.com') domainPart = 'gmail.com';

  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) localPart = localPart.slice(0, plusIndex);

  if (domainPart === 'gmail.com') localPart = localPart.replace(/\./g, '');

  return `${localPart}@${domainPart}`;
}

export function jaroWinkler(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  const a = String(s1);
  const b = String(s2);
  const aLen = a.length;
  const bLen = b.length;
  const matchDistance = Math.floor(Math.max(aLen, bLen) / 2) - 1;
  const aMatches = new Array(aLen).fill(false);
  const bMatches = new Array(bLen).fill(false);
  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const simJaro = ((matches / aLen) + (matches / bLen) + ((matches - transpositions / 2) / matches)) / 3.0;
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(aLen, bLen));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return simJaro + (prefix * 0.1 * (1 - simJaro));
}

export function checkDuplicates(candidate, existingPersons = [], pendingRequests = []) {
  const flags = [];
  const candNameNorm = normalizeName(candidate.full_name);
  const candEmailNorm = normalizeEmail(candidate.email);
  const candPhoneNorm = normalizePhone(candidate.phone);
  const candFatherId = candidate.father_person_id ? String(candidate.father_person_id).trim() : '';
  const candMotherId = candidate.mother_person_id ? String(candidate.mother_person_id).trim() : '';

  const recordsToCheck = [...existingPersons];
  for (const req of pendingRequests) {
    if (req.status !== 'Pending') continue;
    try {
      const payload = typeof req.payload_json === 'string' ? JSON.parse(req.payload_json) : req.payload_json;
      if (payload) {
        if (payload.husband) recordsToCheck.push({ ...payload.husband, is_pending_request: true });
        if (payload.wife) recordsToCheck.push({ ...payload.wife, is_pending_request: true });
        if (payload.person) recordsToCheck.push({ ...payload.person, is_pending_request: true });
      }
    } catch {}
  }

  for (const existing of recordsToCheck) {
    if (candidate.person_id && existing.person_id && candidate.person_id === existing.person_id) continue;
    const existEmailNorm = existing.email_norm || normalizeEmail(existing.email);
    const existPhoneNorm = existing.phone_norm || normalizePhone(existing.phone);
    const existNameNorm = existing.name_norm || normalizeName(existing.full_name);
    const existFatherId = existing.father_person_id ? String(existing.father_person_id).trim() : '';
    const existMotherId = existing.mother_person_id ? String(existing.mother_person_id).trim() : '';

    if (candEmailNorm && existEmailNorm && candEmailNorm === existEmailNorm) {
      return {
        blocked: true,
        reason: 'A matching record exists. Please raise a link request.',
        flags: ['EXACT_EMAIL_MATCH']
      };
    }

    if (candPhoneNorm && existPhoneNorm && candPhoneNorm === existPhoneNorm) {
      flags.push({
        type: 'PHONE_SHARED',
        detail: `Phone ${candidate.phone} matches existing record (${existing.member_ref_id || 'Pending'}). Spouses may share phone.`
      });
    }

    if (candNameNorm && candNameNorm === existNameNorm) {
      const parentMatches =
        (candFatherId && existFatherId && candFatherId === existFatherId) ||
        (candMotherId && existMotherId && candMotherId === existMotherId);
      if (parentMatches) {
        flags.push({
          type: 'MINOR_OR_PARENT_MATCH',
          detail: `Matching full name and linked parent with member ${existing.member_ref_id || 'Pending'}.`
        });
      }
    }
  }

  return { blocked: false, flags };
}

export function isMinor(dobString) {
  if (!dobString) return false;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age < 18;
}

/**
 * Check A4 Family Match: Same Name and DOB within the selected family branch.
 * PRD v4.0: This is a WARNING (not a hard block) allowing "Go Back" and "Proceed Anyway".
 */
export function checkA4FamilyMatch(candidate, familyPersons = []) {
  if (!candidate || !familyPersons || familyPersons.length === 0) return { warning: false };

  const candFirst = normalizeName(candidate.first_name || (candidate.full_name ? candidate.full_name.split(/\s+/)[0] : ''));
  const candLast = normalizeName(candidate.last_name || (candidate.full_name ? candidate.full_name.split(/\s+/).pop() : ''));
  const candDob = String(candidate.dob || '').trim();

  for (const p of familyPersons) {
    if (candidate.person_id && p.person_id && candidate.person_id === p.person_id) continue;

    const pFirst = normalizeName(p.first_name || (p.full_name ? p.full_name.split(/\s+/)[0] : ''));
    const pLast = normalizeName(p.last_name || (p.full_name ? p.full_name.split(/\s+/).pop() : ''));
    const pDob = String(p.dob || '').trim();

    const nameMatch = candFirst && pFirst && candFirst === pFirst && candLast && pLast && candLast === pLast;
    const dobMatch = candDob && pDob && candDob === pDob;

    if (nameMatch && dobMatch) {
      return {
        warning: true,
        code: 'A4_FAMILY_MATCH',
        message: 'A person with the same name and date of birth already exists in this family branch.',
        matched_member: p.full_name || p.member_ref_id
      };
    }
  }

  return { warning: false };
}
