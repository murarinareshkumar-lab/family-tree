import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import { PlusCircle, ShieldCheck, Mail, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export default function OnboardSurnamePage({ onNavigate }) {
  const [surnameName, setSurnameName] = useState('');
  
  // Husband details
  const [husbandName, setHusbandName] = useState('');
  const [husbandEmail, setHusbandEmail] = useState('');
  const [husbandPhone, setHusbandPhone] = useState('');
  const [husbandDob, setHusbandDob] = useState('');

  // Wife details
  const [wifeName, setWifeName] = useState('');
  const [wifeEmail, setWifeEmail] = useState('');
  const [wifePhone, setWifePhone] = useState('');
  const [wifeDob, setWifeDob] = useState('');

  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaVerified) {
      setError('Please complete the anti-bot verification check.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      type: 'ONBOARD_SURNAME',
      requester_email: husbandEmail,
      captcha_token: 'valid',
      payload: {
        surname_name: surnameName.trim(),
        husband: {
          full_name: husbandName.trim(),
          email: husbandEmail.trim(),
          phone: husbandPhone.trim(),
          dob: husbandDob,
          gender: 'Male',
          relationship: 'SPOUSE'
        },
        wife: {
          full_name: wifeName.trim(),
          email: wifeEmail.trim(),
          phone: wifePhone.trim(),
          dob: wifeDob,
          gender: 'Female',
          relationship: 'SPOUSE'
        }
      }
    };

    try {
      const res = await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setTicketResult(res);
    } catch (err) {
      setError(err.message || 'Submission failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  if (ticketResult) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900">Request Submitted Successfully!</h2>
        <p className="text-center text-sm text-slate-600 mt-2">
          Your onboarding request has been recorded. Reference IDs will be generated permanently upon Administrator approval.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Your Tracking Ticket ID</span>
          <p className="text-2xl font-mono font-extrabold text-emerald-700 mt-1 select-all">
            {ticketResult.ticket_id}
          </p>
        </div>

        <div className="mt-6 p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-900 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-amber-800">
            <Mail className="w-4 h-4" />
            <span>Important Verification Step Required</span>
          </div>
          <p>
            To prevent unauthorized family creation, please send an email from <strong>{husbandEmail}</strong> or <strong>{wifeEmail}</strong> to our support mailbox:
          </p>
          <p className="font-mono bg-white p-2 rounded-lg border border-amber-200 text-slate-800 font-semibold select-all">
            support@familytree.local
          </p>
          <p>
            With the exact subject: <strong className="font-mono select-all">Verify Ticket: {ticketResult.ticket_id}</strong>
          </p>
          <p className="text-xs text-amber-700">
            The admin will verify SPF/DKIM/DMARC headers to ensure authenticated ownership before assigning your permanent Surname Reference ID.
          </p>
        </div>

        <div className="mt-8 flex justify-center space-x-3">
          <button
            onClick={() => onNavigate('ticket-status')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20"
          >
            Track Status Now
          </button>
          <button
            onClick={() => onNavigate('tree')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
          >
            Return to Tree
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Onboard New Surname</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Establish a new family lineage. Requires founding husband and wife records.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Surname Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Family Surname / Lineage Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Patil, Sharma, Rao, Kulkarni"
              value={surnameName}
              onChange={(e) => setSurnameName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Supports Unicode characters (e.g., Kannada, Hindi, Telugu). System generates permanent Ref ID upon Admin approval.
            </p>
          </div>

          {/* Husband Section */}
          <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Founding Member 1 (Husband)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                SPOUSE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={husbandName}
                  onChange={(e) => setHusbandName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={husbandDob}
                  onChange={(e) => setHusbandDob(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@example.com"
                  value={husbandEmail}
                  onChange={(e) => setHusbandEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 9876543210"
                  value={husbandPhone}
                  onChange={(e) => setHusbandPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Wife Section */}
          <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-800">
                Founding Member 2 (Wife)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">
                SPOUSE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunita Patil"
                  value={wifeName}
                  onChange={(e) => setWifeName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={wifeDob}
                  onChange={(e) => setWifeDob(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="sunita@example.com"
                  value={wifeEmail}
                  onChange={(e) => setWifeEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 9876543211"
                  value={wifePhone}
                  onChange={(e) => setWifePhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Bot Protection */}
          <CaptchaWidget verified={captchaVerified} onVerify={setCaptchaVerified} />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Submit Surname Onboarding Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
