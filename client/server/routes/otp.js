import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { createAndSendOtp, verifyOtp } from '../../lib/otp.js';
import { normalizeEmail } from '../../lib/duplicates.js';
import { TABS } from '../../lib/schema.js';

const router = express.Router();

export const EXISTING_MEMBER_PURPOSES = new Set([
  'EXISTING_MEMBER_EMAIL_VERIFICATION',
  'EDIT_MEMBER',
  'EXISTING_MEMBER',
  'UPDATE_MEMBER',
  'EMAIL_CHANGE'
]);

/**
 * POST /api/otp/send
 * Enforces strict separation between Flow A (New Person) and Flow B (Existing Member).
 */
router.post('/send', async (req, res) => {
  try {
    const { email, purpose, request_ref, member_ref_id, person_id } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (!purpose || typeof purpose !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Please provide a valid purpose for the verification code.'
      });
    }

    const emailNorm = normalizeEmail(email);
    const upperPurpose = purpose.toUpperCase().trim();
    const sheetsClient = await getSheetsClient();

    // =========================================================================
    // Flow B: Existing Member Update (EDIT_MEMBER, EXISTING_MEMBER_EMAIL_VERIFICATION)
    // =========================================================================
    if (EXISTING_MEMBER_PURPOSES.has(upperPurpose)) {
      if (!member_ref_id && !person_id) {
        return res.status(400).json({
          ok: false,
          error: 'Member reference ID is required to verify an existing member.'
        });
      }

      const persons = await sheetsClient.getRows(TABS.PERSONS);
      const targetMember = persons.find(p =>
        (member_ref_id && String(p.member_ref_id || '').trim().toUpperCase() === String(member_ref_id).trim().toUpperCase()) ||
        (person_id && String(p.person_id || '').trim() === String(person_id).trim())
      );

      if (!targetMember) {
        return res.status(404).json({
          ok: false,
          error: 'Member not found with the provided reference ID.'
        });
      }

      const storedEmailNorm = normalizeEmail(targetMember.email);
      if (!storedEmailNorm || storedEmailNorm !== emailNorm) {
        // Hard block: Do NOT send OTP if email does not match registered email
        return res.status(400).json({
          ok: false,
          error: 'The email address does not match the registered email for this member.',
          code: 'EMAIL_MISMATCH'
        });
      }

      // Email matches registered email: Send OTP
      const result = await createAndSendOtp({
        email,
        purpose: upperPurpose,
        request_ref: request_ref || member_ref_id || '',
        sheetsClient
      });

      return res.json({
        ok: true,
        message: 'A verification code has been sent to your registered email address.',
        resendAfterSeconds: result.resendAfterSeconds || 30,
        flow: 'EXISTING_MEMBER'
      });
    }

    // =========================================================================
    // Flow A: New Person / First-Time Onboarding
    // (NEW_PERSON_EMAIL_VERIFICATION, ONBOARD_SURNAME, FOUNDING_MEMBER, ADD_MEMBER, JOIN_REQUEST)
    // =========================================================================
    const persons = await sheetsClient.getRows(TABS.PERSONS);
    const requests = await sheetsClient.getRows(TABS.REQUESTS);

    // 1. Check existing approved or merged persons
    const duplicatePerson = persons.find(p => {
      const pEmailNorm = normalizeEmail(p.email);
      return pEmailNorm && pEmailNorm === emailNorm;
    });

    if (duplicatePerson) {
      return res.status(400).json({
        ok: false,
        error: 'The provided email address is already registered.',
        code: 'DUPLICATE_EMAIL'
      });
    }

    // 2. Check active pending requests
    for (const reqRow of requests) {
      const status = String(reqRow.status || '').toLowerCase();
      if (['approved', 'rejected', 'merged', 'delinked'].includes(status)) continue;
      try {
        const payload = typeof reqRow.payload_json === 'string'
          ? JSON.parse(reqRow.payload_json)
          : reqRow.payload_json;
        if (!payload) continue;

        const checkEmails = [
          payload.email,
          payload.requester_email,
          payload.husband?.email,
          payload.wife?.email,
          payload.person?.email,
          payload.member?.email
        ].filter(Boolean);

        const hasPendingMatch = checkEmails.some(em => normalizeEmail(em) === emailNorm);
        if (hasPendingMatch) {
          return res.status(400).json({
            ok: false,
            error: 'The provided email address is already registered.',
            code: 'DUPLICATE_EMAIL'
          });
        }
      } catch {}
    }

    // Available email: Send OTP directly
    const result = await createAndSendOtp({
      email,
      purpose: upperPurpose,
      request_ref: request_ref || '',
      sheetsClient
    });

    return res.json({
      ok: true,
      message: 'A verification code has been sent to the email address provided.',
      resendAfterSeconds: result.resendAfterSeconds || 30,
      flow: 'NEW_PERSON'
    });
  } catch (err) {
    if (err.code === 'RESEND_GAP') {
      return res.status(429).json({
        ok: false,
        error: err.message,
        resendAfterSeconds: err.resendAfterSeconds
      });
    }
    if (err.code === 'MAX_RESENDS') {
      return res.status(429).json({
        ok: false,
        error: err.message
      });
    }
    console.error('OTP Send Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unable to send verification code at this time. Please try again shortly.'
    });
  }
});

/**
 * POST /api/otp/verify
 * Validates 6-digit code and issues short-lived verification token.
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, purpose, code } = req.body || {};

    if (!email || !purpose || !code) {
      return res.status(400).json({
        ok: false,
        error: 'Email, purpose, and verification code are required.'
      });
    }

    const sheetsClient = await getSheetsClient();
    const result = await verifyOtp({
      email,
      purpose: purpose.toUpperCase().trim(),
      code: String(code).trim(),
      sheetsClient
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error || 'Verification failed. Please check your code.'
      });
    }

    return res.json({
      ok: true,
      verified: true,
      message: 'Email verified successfully.',
      token: result.token
    });
  } catch (err) {
    console.error('OTP Verify Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Verification service error. Please try again.'
    });
  }
});

export default router;
