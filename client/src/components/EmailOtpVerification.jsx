import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, Send, AlertTriangle } from 'lucide-react';

export default function EmailOtpVerification({
  email,
  purpose = 'NEW_PERSON_EMAIL_VERIFICATION',
  member_ref_id = '',
  person_id = '',
  onVerified,
  label = 'Email Verification',
  disabled = false
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [previewCode, setPreviewCode] = useState('');

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          purpose,
          member_ref_id: member_ref_id ? member_ref_id.trim() : undefined,
          person_id: person_id ? person_id.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setCodeSent(true);
      setMessage(data.message || 'A verification code has been sent to the email address provided.');
      setResendCooldown(data.resendAfterSeconds || 30);
      setPreviewCode(data.previewCode || '');
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          purpose,
          code: code.trim(),
          member_ref_id: member_ref_id ? member_ref_id.trim() : undefined,
          person_id: person_id ? person_id.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.verified) {
        throw new Error(data.error || 'Verification code is invalid or expired.');
      }

      setVerified(true);
      setMessage('Email verified successfully.');
      if (onVerified) {
        onVerified(data.token);
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm">
        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span><strong>{email}</strong> verified successfully.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold text-slate-700">{label}</span>
        {resendCooldown > 0 && (
          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            Resend in {resendCooldown}s
          </span>
        )}
      </div>

      {!codeSent ? (
        <button
          type="button"
          onClick={handleSendCode}
          disabled={disabled || loading || !email}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? 'Sending Code...' : 'Send Verification Code'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              disabled={disabled || loading}
              className="flex-1 px-3 py-1.5 text-sm tracking-widest text-center border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={disabled || loading || code.length !== 6}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              {loading ? 'Checking...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={disabled || loading || resendCooldown > 0}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Resend
            </button>
          </div>
        </div>
      )}

      {previewCode && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              SMTP Not Configured - Test OTP:
            </span>
            <button
              type="button"
              onClick={() => setCode(previewCode)}
              className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-mono text-[11px] rounded transition font-medium"
            >
              Auto-fill Code
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-amber-950 bg-amber-100 px-2.5 py-1 rounded border border-amber-300 tracking-widest">
              {previewCode}
            </span>
            <span className="text-[11px] text-amber-700">
              (Use this code or click Auto-fill to test immediately)
            </span>
          </div>
          <p className="text-[10px] text-amber-700 leading-relaxed">
            Note: To receive codes in your actual email inbox, configure SMTP_HOST, SMTP_USER, and SMTP_PASS in Vercel environment variables.
          </p>
        </div>
      )}

      {message && (
        <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
          {message}
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
          {error}
        </p>
      )}
    </div>
  );
}
