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
 * Member reference: "FM-" + 8 random characters.
 * Alphabet: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0, O, 1, I).
 * Regenerates on collision against ALL existing IDs.
 */
export function generateMemberRefId(existingIds = new Set()) {
  const existingSet = existingIds instanceof Set
    ? existingIds
    : new Set(Array.from(existingIds || []).map(s => String(s).toUpperCase()));

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
