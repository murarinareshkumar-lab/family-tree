import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, Send } from 'lucide-react';

export default function EmailOtpVerification({
  email,
  purpose,
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
        body: JSON.stringify({ email, purpose })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setCodeSent(true);
      setMessage(data.message || 'Verification code sent to your email.');
      setResendCooldown(data.resendAfterSeconds || 30);
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
        body: JSON.stringify({ email, purpose, code: code.trim() })
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
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <span><strong>{email}</strong> is verified successfully.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {resendCooldown > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Resend available in {resendCooldown}s
          </span>
        )}
      </div>

      {!codeSent ? (
        <button
          type="button"
          onClick={handleSendCode}
          disabled={disabled || loading || !email}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-md shadow-sm transition"
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
              className="flex-1 px-3 py-1.5 text-sm tracking-widest text-center border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={disabled || loading || code.length !== 6}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-md shadow-sm transition"
            >
              {loading ? 'Checking...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={disabled || loading || resendCooldown > 0}
              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-md transition"
            >
              Resend
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="text-xs text-emerald-700 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          {message}
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
