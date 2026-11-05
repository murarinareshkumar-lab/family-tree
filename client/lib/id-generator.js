export function normalizeSurnameLetters(surname) {
  if (!surname) return '';
  return String(surname)
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function generateSurnameRefId(surnameText, existingSurnameIds = new Set()) {
  const existingSet = existingSurnameIds instanceof Set
    ? existingSurnameIds
    : new Set(existingSurnameIds.map(s => String(s).toUpperCase()));

  let clean = normalizeSurnameLetters(surnameText);
  if (!clean) clean = 'FAM';

  let padded = clean;
  if (padded.length === 1) padded = padded + 'XX';
  else if (padded.length === 2) padded = padded + 'X';

  for (let n = 3; n <= padded.length; n++) {
    const candidate = padded.slice(0, n) + 'FT';
    if (!existingSet.has(candidate)) return candidate;
  }

  const fullBase = padded + 'FT';
  let counter = 2;
  while (true) {
    const candidate = `${fullBase}${counter}`;
    if (!existingSet.has(candidate)) return candidate;
    counter++;
  }
}

export function formatMemberRefId(surnameRefId, seqNumber) {
  const num = parseInt(seqNumber, 10);
  if (isNaN(num) || num < 1) throw new Error(`Invalid sequence number: ${seqNumber}`);
  const paddedSeq = String(num).padStart(4, '0');
  return `${surnameRefId.toUpperCase()}-${paddedSeq}`;
}
