export const NAME_REGEX = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name, isRequired = true) {
  if (name === null || name === undefined || name === '') {
    if (isRequired) return { valid: false, error: 'Name is required' };
    return { valid: true, value: '' };
  }
  const trimmed = String(name).trim();
  if (!trimmed) {
    if (isRequired) return { valid: false, error: 'Name is required' };
    return { valid: true, value: '' };
  }
  if (!NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Letters only (Unicode allowed), single space inside, no digits or symbols'
    };
  }
  return { valid: true, value: trimmed };
}

export function cleanPhone(phone) {
  if (!phone) return '';
  let str = String(phone).replace(/\s+/g, '');
  if (str.startsWith('+91')) {
    str = str.slice(3);
  } else if (str.startsWith('91') && str.length === 12) {
    str = str.slice(2);
  }
  return str;
}

export function validatePhone(phone, isRequired = true) {
  if (!phone) {
    if (isRequired) return { valid: false, error: 'Phone number is required' };
    return { valid: true, value: '' };
  }
  const cleaned = cleanPhone(phone);
  if (!PHONE_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'Must be exactly 10 digits starting with 6, 7, 8 or 9'
    };
  }
  return { valid: true, value: cleaned };
}

export function validateEmail(email, isRequired = true) {
  if (!email) {
    if (isRequired) return { valid: false, error: 'Email address is required' };
    return { valid: true, value: '' };
  }
  const trimmed = String(email).trim().toLowerCase();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email exceeds maximum allowed length of 254 characters' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true, value: trimmed };
}

export function formatDobMask(val) {
  const digits = String(val || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseAndValidateDob(raw, { minAge = 0 } = {}) {
  if (!raw) return { valid: false, error: 'Date of birth is required' };
  let day, month, year;
  const str = String(raw).trim();
  const digitsOnly = str.replace(/\D/g, '');

  if (str.includes('-') && str.split('-')[0].length === 4) {
    const parts = str.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  } else if (digitsOnly.length === 8) {
    day = parseInt(digitsOnly.slice(0, 2), 10);
    month = parseInt(digitsOnly.slice(2, 4), 10);
    year = parseInt(digitsOnly.slice(4, 8), 10);
  }

  if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, error: 'Enter 8 digits as DD/MM/YYYY (e.g. 01/01/1950)' };
  }

  if (year < 1900) {
    return { valid: false, error: 'Year must be 1900 or later' };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be between 01 and 12' };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      valid: false,
      error: `Invalid day ${day} for month ${String(month).padStart(2, '0')} (max ${daysInMonth})`
    };
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (birthDate > today) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  let age = today.getFullYear() - year;
  const mDiff = today.getMonth() - (month - 1);
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }

  if (minAge > 0 && age < minAge) {
    return { valid: false, error: `Must be at least ${minAge} years old (currently ${age})` };
  }

  const yyyyMmDd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const ddMmYyyy = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  return { valid: true, value: yyyyMmDd, display: ddMmYyyy, age };
}
