import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';
import { createAndSendOtp, verifyOtp } from '../../lib/otp.js';

const router = express.Router();

/**
 * POST /api/otp/send
 * Enforces uniform response to avoid revealing registered emails.
 */
router.post('/send', async (req, res) => {
  try {
    const { email, purpose, request_ref } = req.body || {};

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

    const sheetsClient = await getSheetsClient();

    try {
      const result = await createAndSendOtp({
        email,
        purpose,
        request_ref: request_ref || '',
        sheetsClient
      });

      return res.json({
        ok: true,
        message: 'If this email is registered, a code has been sent.',
        resendAfterSeconds: result.resendAfterSeconds || 30
      });
    } catch (otpErr) {
      if (otpErr.code === 'RESEND_GAP') {
        return res.status(429).json({
          ok: false,
          error: otpErr.message,
          resendAfterSeconds: otpErr.resendAfterSeconds
        });
      }
      if (otpErr.code === 'MAX_RESENDS') {
        return res.status(429).json({
          ok: false,
          error: otpErr.message
        });
      }
      throw otpErr;
    }
  } catch (err) {
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
      purpose,
      code,
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
      token: result.token
    });
  } catch (err) {
    console.error('OTP Verify Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unable to verify code at this time. Please try again.'
    });
  }
});

export default router;
