import { randomInt } from 'node:crypto';

export const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeSurnameLetters(surname) {
  if (!surname) return '';
  return String(surname)
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/**
 * Generate cryptographically secure random string from alphabet
 */
export function generateRandomCode(length, alphabet = ID_ALPHABET) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = randomInt(0, alphabet.length);
    result += alphabet[idx];
  }
  return result;
}

/**
 * Founding family reference: "FT-" + 6 random characters.
 * Alphabet: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0, O, 1, I).
 * Regenerates on collision against ALL existing IDs.
 */
export function generateFamilyRefId(existingIds = new Set()) {
  const existingSet = existingIds instanceof Set
    ? existingIds
    : new Set(Array.from(existingIds || []).map(s => String(s).toUpperCase()));

  while (true) {
    const code = generateRandomCode(6, ID_ALPHABET);
    const candidate = `FT-${code}`;
    if (!existingSet.has(candidate.toUpperCase())) {
      existingSet.add(candidate.toUpperCase());
      return candidate;
    }
  }
}

/**
 * Member Reference ID Generator:
 * PRD v4.0 format: SS-FFF-MMYYYY-NNN (e.g. MU-NAR-071995-001)
 * - SS: First 2 letters of surname (pad with 'X' if shorter)
 * - FFF: First 3 letters of first name (pad with 'X' if shorter)
 * - MMYYYY: Month (2 digits) and Year (4 digits) of birth, or 00YYYY for year-only, or 000000 for unknown
 * - NNN: 3-digit sequence starting at 001, avoiding collisions against existing IDs
 *
 * Backwards-compatible with Set/Array argument as existingIds (generates FM-XXXXXXXX).
 */
export function generateMemberRefId(personOrExisting = new Set(), maybeExisting = new Set()) {
  let existingSet;
  let person = null;

  if (personOrExisting instanceof Set || Array.isArray(personOrExisting)) {
    existingSet = personOrExisting instanceof Set
      ? personOrExisting
      : new Set(Array.from(personOrExisting || []).map(s => String(s).toUpperCase()));
  } else if (typeof personOrExisting === 'object' && personOrExisting !== null) {
    person = personOrExisting;
    existingSet = maybeExisting instanceof Set
      ? maybeExisting
      : new Set(Array.from(maybeExisting || []).map(s => String(s).toUpperCase()));
  } else {
    existingSet = new Set();
  }

  if (person && (person.surname || person.full_name || person.firstName || person.first_name || person.last_name)) {
    // 1. Surname (SS)
    const surnameRaw = person.surname || person.last_name || (person.full_name ? person.full_name.trim().split(/\s+/).pop() : '');
    const cleanSurname = normalizeSurnameLetters(surnameRaw);
    let ss = cleanSurname.slice(0, 2);
    if (ss.length === 0) ss = 'XX';
    else if (ss.length === 1) ss = ss + 'X';

    // 2. First Name (FFF)
    const firstRaw = person.firstName || person.first_name || (person.full_name ? person.full_name.trim().split(/\s+/)[0] : '');
    const cleanFirst = normalizeSurnameLetters(firstRaw);
    let fff = cleanFirst.slice(0, 3);
    if (fff.length === 0) fff = 'XXX';
    else if (fff.length === 1) fff = fff + 'XX';
    else if (fff.length === 2) fff = fff + 'X';

    // 3. MMYYYY from DOB
    let mmyyyy = '000000';
    if (person.dob) {
      const dobStr = String(person.dob).trim();
      const isoMatch = dobStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dmyMatch = dobStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
      const yearOnlyMatch = dobStr.match(/^(\d{4})$/);
      if (isoMatch) {
        mmyyyy = `${isoMatch[2]}${isoMatch[1]}`;
      } else if (dmyMatch) {
        mmyyyy = `${dmyMatch[2]}${dmyMatch[3]}`;
      } else if (yearOnlyMatch) {
        mmyyyy = `00${yearOnlyMatch[1]}`;
      }
    }

    const prefix = `${ss}-${fff}-${mmyyyy}-`;

    // Global sequence increment: scan all existing IDs to find the maximum sequence number across all members in the system
    let maxSeq = 0;
    for (const id of existingSet) {
      const m = String(id).match(/-(\d{3,})$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    let seq = Math.max(1, maxSeq + 1);
    while (true) {
      const seqStr = String(seq).padStart(3, '0');
      const candidate = `${prefix}${seqStr}`;
      if (!existingSet.has(candidate.toUpperCase())) {
        existingSet.add(candidate.toUpperCase());
        return candidate;
      }
      seq++;
    }
  }

  // Fallback: Random FM-XXXXXXXX format
  while (true) {
    const code = generateRandomCode(8, ID_ALPHABET);
    const candidate = `FM-${code}`;
    if (!existingSet.has(candidate.toUpperCase())) {
      existingSet.add(candidate.toUpperCase());
      return candidate;
    }
  }
}

/**
 * branch_no = highest branch_no among Approved or Merged families with the same surname_norm + 1 (never reassigned).
 */
export function computeNextBranchNo(surnameNorm, allSurnames = []) {
  const normTarget = normalizeSurnameLetters(surnameNorm);
  let maxBranch = 0;
  for (const s of allSurnames) {
    const sNorm = s.surname_norm ? normalizeSurnameLetters(s.surname_norm) : normalizeSurnameLetters(s.surname_name);
    const sStatus = String(s.status || '').toLowerCase();
    if (sNorm === normTarget && (sStatus === 'approved' || sStatus === 'merged')) {
      const bNum = parseInt(s.branch_no, 10);
      if (!isNaN(bNum) && bNum > maxBranch) {
        maxBranch = bNum;
      }
    }
  }
  return maxBranch + 1;
}

// Backward compatibility helpers
export function generateSurnameRefId(surnameText, existingSurnameIds = new Set()) {
  return generateFamilyRefId(existingSurnameIds);
}

export function formatMemberRefId(surnameRefId, seqNumber, existingMemberIds = new Set()) {
  return generateMemberRefId(existingMemberIds);
}
