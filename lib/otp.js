import { createHmac, randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { TABS } from './schema.js';
import { normalizeEmail } from './duplicates.js';
import { sendOtpEmail } from './email.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-at-least-32-characters-long';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_GAP_MS = 30 * 1000; // 30 seconds
const MAX_RESENDS = 3;
const MAX_ATTEMPTS = 5;

/**
 * Calculate HMAC hash of the OTP code
 * Never stores plain text codes anywhere.
 */
export function hashOtpCode(code, emailNorm, purpose) {
  return createHmac('sha256', JWT_SECRET)
    .update(`${emailNorm.toLowerCase().trim()}:${purpose}:${String(code).trim()}`)
    .digest('hex');
}

/**
 * Generate 6-digit cryptographically secure OTP code
 */
export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

/**
 * Create and send an OTP code
 */
export async function createAndSendOtp({ email, purpose, request_ref = '', sheetsClient, overrideCode = null }) {
  if (!email || !purpose) {
    throw new Error('Email and purpose are required to send an OTP');
  }

  const emailNorm = normalizeEmail(email);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Find previous active OTP records for this email and purpose
  const allOtps = await sheetsClient.getRows(TABS.OTP);
  const existingActive = allOtps.filter(row =>
    row.email_norm === emailNorm &&
    row.purpose === purpose &&
    (row.status === 'PENDING' || !row.status)
  );

  let currentResends = 0;

  if (existingActive.length > 0) {
    // Sort by last_sent_at descending
    existingActive.sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime());
    const latest = existingActive[0];

    const lastSentTime = new Date(latest.last_sent_at).getTime();
    const elapsed = now - lastSentTime;

    if (elapsed < RESEND_GAP_MS) {
      const remainingSeconds = Math.ceil((RESEND_GAP_MS - elapsed) / 1000);
      const error = new Error(`Please wait ${remainingSeconds} seconds before requesting a new code.`);
      error.code = 'RESEND_GAP';
      error.resendAfterSeconds = remainingSeconds;
      throw error;
    }

    const prevResends = parseInt(latest.resends || '0', 10);
    if (prevResends >= MAX_RESENDS) {
      const error = new Error('Maximum OTP resend attempts exceeded. Please try again later.');
      error.code = 'MAX_RESENDS';
      throw error;
    }

    currentResends = prevResends + 1;

    // Cancel all previous pending codes
    for (const item of existingActive) {
      await sheetsClient.updateRow(TABS.OTP, 'otp_id', item.otp_id, {
        status: 'CANCELLED'
      });
    }
  }

  const code = overrideCode || generateOtpCode();
  const codeHash = hashOtpCode(code, emailNorm, purpose);
  const expiresAt = new Date(now + OTP_EXPIRY_MS).toISOString();
  const otpId = `otp-${randomUUID()}`;

  await sheetsClient.appendRow(TABS.OTP, {
    otp_id: otpId,
    purpose,
    email_norm: emailNorm,
    request_ref: request_ref || '',
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: '0',
    resends: String(currentResends),
    last_sent_at: nowIso,
    status: 'PENDING'
  });

  // Send email via nodemailer (or simulated fallback)
  const emailRes = await sendOtpEmail({
    toEmail: email,
    otpCode: code,
    purpose
  });

  return {
    ok: true,
    otpId,
    resendAfterSeconds: 30,
    resendsLeft: MAX_RESENDS - currentResends,
    simulated: Boolean(emailRes.simulated),
    previewCode: emailRes.simulated ? code : undefined
  };
}

/**
 * Verify an OTP code and issue a signed verification token
 */
export async function verifyOtp({ email, purpose, code, sheetsClient }) {
  if (!email || !purpose || !code) {
    return { ok: false, error: 'Email, purpose, and verification code are required' };
  }

  const emailNorm = normalizeEmail(email);
  const inputHash = hashOtpCode(code, emailNorm, purpose);
  const now = Date.now();

  const allOtps = await sheetsClient.getRows(TABS.OTP);
  const pendingRecords = allOtps.filter(row =>
    row.email_norm === emailNorm &&
    row.purpose === purpose &&
    (row.status === 'PENDING' || !row.status)
  );

  if (pendingRecords.length === 0) {
    return { ok: false, error: 'No active verification code found. Please request a new code.' };
  }

  // Get most recent pending OTP
  pendingRecords.sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime());
  const activeOtp = pendingRecords[0];

  // Check expiration
  const expiryTime = new Date(activeOtp.expires_at).getTime();
  if (now > expiryTime) {
    await sheetsClient.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
      status: 'EXPIRED'
    });
    return { ok: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Check attempt limit
  let attempts = parseInt(activeOtp.attempts || '0', 10);
  if (attempts >= MAX_ATTEMPTS) {
    await sheetsClient.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
      status: 'MAX_ATTEMPTS_EXCEEDED'
    });
    return { ok: false, error: 'Maximum verification attempts exceeded. Please request a new code.' };
  }

  // Check hash
  if (activeOtp.code_hash !== inputHash) {
    attempts += 1;
    const newStatus = attempts >= MAX_ATTEMPTS ? 'MAX_ATTEMPTS_EXCEEDED' : 'PENDING';
    await sheetsClient.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
      attempts: String(attempts),
      status: newStatus
    });

    const attemptsRemaining = MAX_ATTEMPTS - attempts;
    if (attemptsRemaining <= 0) {
      return { ok: false, error: 'Incorrect code. Maximum attempts exceeded. Please request a new code.' };
    }
    return {
      ok: false,
      error: `Incorrect verification code. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`
    };
  }

  // Successful verification
  await sheetsClient.updateRow(TABS.OTP, 'otp_id', activeOtp.otp_id, {
    status: 'VERIFIED',
    verified_at: new Date(now).toISOString()
  });

  // Issue signed short-lived JWT verification token (15 mins)
  const token = jwt.sign(
    {
      email_norm: emailNorm,
      purpose,
      request_ref: activeOtp.request_ref || '',
      verified: true
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  return {
    ok: true,
    verified: true,
    token
  };
}

/**
 * Validate a verification token on form submission
 */
export function verifyVerificationToken(token, expectedPurpose, expectedEmail) {
  if (!token) return { valid: false, error: 'Missing verification token' };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.verified) {
      return { valid: false, error: 'Invalid verification token' };
    }

    if (expectedPurpose) {
      const aliases = {
        'ONBOARD_SURNAME': ['ONBOARD_SURNAME', 'NEW_PERSON_EMAIL_VERIFICATION'],
        'ADD_MEMBER': ['ADD_MEMBER', 'NEW_PERSON_EMAIL_VERIFICATION'],
        'JOIN_TREE': ['JOIN_TREE', 'NEW_PERSON_EMAIL_VERIFICATION'],
        'EDIT_MEMBER': ['EDIT_MEMBER', 'UPDATE_MEMBER', 'EXISTING_MEMBER_EMAIL_VERIFICATION'],
        'UPDATE_MEMBER': ['EDIT_MEMBER', 'UPDATE_MEMBER', 'EXISTING_MEMBER_EMAIL_VERIFICATION'],
        'LINK_FAMILIES': ['LINK_FAMILIES', 'EXISTING_MEMBER_EMAIL_VERIFICATION'],
        'MERGE_FAMILIES': ['MERGE_FAMILIES', 'EXISTING_MEMBER_EMAIL_VERIFICATION']
      };
      const allowed = Array.isArray(expectedPurpose)
        ? expectedPurpose
        : (aliases[expectedPurpose] || [expectedPurpose]);

      if (!allowed.includes(decoded.purpose)) {
        return { valid: false, error: 'Verification token purpose mismatch' };
      }
    }

    if (expectedEmail) {
      const normExpected = normalizeEmail(expectedEmail);
      if (decoded.email_norm !== normExpected) {
        return { valid: false, error: 'Verification token email mismatch' };
      }
    }

    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: 'Verification token expired or invalid. Please verify again.' };
  }
}
