import crypto from 'node:crypto';

/**
 * PII Columns that contain sensitive personal or contact information
 */
export const PII_COLUMNS = new Set([
  'email',
  'email_norm',
  'phone',
  'phone_norm',
  'dob',
  'date_of_death',
  'location',
  'occupation',
  'requester_email',
  'second_party_email',
  'payload_json'
]);

/**
 * Deterministically derives a 32-byte key for AES-256-GCM.
 */
function getGcmKey() {
  const secret = process.env.PII_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'family-tree-portal-gcm256-pii-default-master-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plain-text PII string using AES-256-GCM.
 * Format: enc:gcm:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 */
export function encryptPii(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str.trim()) return str;

  // Prevent double-encryption
  if (str.startsWith('enc:gcm:v1:')) return str;

  try {
    const key = getGcmKey();
    const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(str, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `enc:gcm:v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
  } catch (err) {
    console.warn('[PII Encrypt] Warning:', err.message);
    return str;
  }
}

/**
 * Decrypts an encrypted PII string.
 * Gracefully handles unencrypted plain text and legacy base64 strings.
 */
export function decryptPii(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str.trim()) return str;

  // 1. AES-256-GCM encrypted
  if (str.startsWith('enc:gcm:v1:')) {
    try {
      const parts = str.split(':');
      if (parts.length >= 6) {
        const iv = Buffer.from(parts[3], 'base64');
        const authTag = Buffer.from(parts[4], 'base64');
        const ciphertext = parts[5];

        const key = getGcmKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (err) {
      console.warn('[PII Decrypt] Warning:', err.message);
      return str;
    }
  }

  // 2. Legacy base64 prefix
  if (str.startsWith('b64:')) {
    try {
      return Buffer.from(str.slice(4), 'base64').toString('utf8');
    } catch {
      return str;
    }
  }

  // 3. Unencrypted plain text passed through untouched
  return str;
}

/**
 * Encrypt all PII fields in a row object before writing to Google Sheets
 */
export function encryptRowPii(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const result = { ...row };
  for (const [key, val] of Object.entries(result)) {
    if (PII_COLUMNS.has(key) && val !== null && val !== undefined) {
      result[key] = encryptPii(val);
    }
  }
  return result;
}

/**
 * Decrypt all PII fields in a row object after reading from Google Sheets
 */
export function decryptRowPii(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const result = { ...row };
  for (const [key, val] of Object.entries(result)) {
    if (PII_COLUMNS.has(key) && val !== null && val !== undefined) {
      result[key] = decryptPii(val);
    }
  }
  return result;
}
