import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import EmailOtpVerification from '../components/EmailOtpVerification';
import { FileText, Mail, CheckCircle2, AlertCircle, ArrowRight, GitMerge, UserCheck, Edit3 } from 'lucide-react';

export default function RequestTicketPage({ onNavigate, initialParams = {} }) {
  const [requestType, setRequestType] = useState(initialParams?.type || 'EDIT_MEMBER'); // EDIT_MEMBER, LINK_MEMBERS, MERGE_MEMBERS, EMAIL_CHANGE
  const [requesterEmail, setRequesterEmail] = useState('');
  const [memberRefId, setMemberRefId] = useState('');
  const [requesterOtpToken, setRequesterOtpToken] = useState('');
  
  // Specific payloads
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [secondaryMemberRefId, setSecondaryMemberRefId] = useState(
    initialParams?.husband_ref_id || initialParams?.secondary_member_ref_id || initialParams?.member_ref_id || ''
  );
  const [newEmail, setNewEmail] = useState('');
  const [targetSurnameRefId, setTargetSurnameRefId] = useState(initialParams?.surname_ref_id || '');
  const [changeDetails, setChangeDetails] = useState(
    initialParams?.surname_ref_id
      ? `Request link to existing family branch ${initialParams.surname_ref_id}. Founding Husband: ${initialParams.husband_ref_id || 'N/A'}, Founding Wife: ${initialParams.wife_ref_id || 'N/A'}`
      : initialParams?.display_name
      ? `Request to link with family member ${initialParams.display_name}`
      : ''
  );

  React.useEffect(() => {
    if (initialParams?.type) {
      setRequestType(initialParams.type);
    }
    if (initialParams?.husband_ref_id || initialParams?.secondary_member_ref_id || initialParams?.member_ref_id) {
      setSecondaryMemberRefId(initialParams.husband_ref_id || initialParams.secondary_member_ref_id || initialParams.member_ref_id);
    }
    if (initialParams?.surname_ref_id) {
      setTargetSurnameRefId(initialParams.surname_ref_id);
      setChangeDetails(
        `Request link to existing family branch ${initialParams.surname_ref_id}. Founding Husband: ${initialParams.husband_ref_id || 'N/A'}, Founding Wife: ${initialParams.wife_ref_id || 'N/A'}`
      );
    } else if (initialParams?.display_name) {
      setChangeDetails(`Request to link with family member ${initialParams.display_name}`);
    }
  }, [initialParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!requesterOtpToken) {
      setError('Please verify your registered email address with the verification code first.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      type: requestType,
      requester_email: requesterEmail.trim(),
      otp_token: requesterOtpToken,
      captcha_token: 'valid',
      payload: {
        member_ref_id: memberRefId.trim(),
        secondary_member_ref_id: secondaryMemberRefId.trim() || undefined,
        secondary_email: secondaryEmail.trim() || undefined,
        new_email: newEmail.trim() || undefined,
        details: changeDetails.trim()
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
      <div className="max-w-2xl mx-auto bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-7 shadow-sm text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 text-emerald-400 flex items-center justify-center mx-auto mb-3.5 border border-emerald-800/80">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-center text-white">Ticket Created Successfully!</h2>
        <p className="text-center text-xs sm:text-sm text-slate-300 mt-1">
          Your request for <strong>{requestType.replace('_', ' ')}</strong> has been registered.
        </p>

        <div className="mt-5 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Your Tracking Ticket ID</span>
          <p className="text-xl sm:text-2xl font-mono font-extrabold text-emerald-400 mt-0.5 select-all">
            {ticketResult.ticket_id}
          </p>
        </div>

        <div className="mt-5 p-4 bg-amber-950/60 border border-amber-800 rounded-2xl text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center space-x-1.5 font-bold text-amber-300">
            <Mail className="w-4 h-4" />
            <span>Email Authentication Requirement</span>
          </div>
          <p>
            Please email <strong className="font-mono bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-700">support.familytree@gmail.com</strong> with the subject:
          </p>
          <p className="font-mono bg-slate-950 p-2 rounded-lg border border-amber-800 text-amber-200 font-semibold select-all">
            Verify Ticket: {ticketResult.ticket_id}
          </p>
          {(requestType === 'LINK_MEMBERS' || requestType === 'MERGE_MEMBERS') && (
            <p className="font-semibold text-amber-100">
              Notice: Both parties ({requesterEmail} and {secondaryEmail}) must independently email the support address referencing this ticket before Admin approval.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center space-x-3">
          <button
            onClick={() => onNavigate('ticket-status')}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
          >
            Track Status Now
          </button>
          <button
            onClick={() => onNavigate('tree')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-slate-700"
          >
            Return to Tree
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-sm text-slate-100">
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Submit Verification Ticket</h1>
            <p className="text-xs text-slate-400">
              Request profile edits, minor adult promotion, family linkage, or record merge
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-2xl flex items-center space-x-2 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticket Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Request Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'EDIT_MEMBER', label: 'Edit Member / Minor Turn 18', icon: Edit3 },
                { id: 'LINK_MEMBERS', label: 'Link Existing Members', icon: UserCheck },
                { id: 'MERGE_MEMBERS', label: 'Merge Duplicate Records', icon: GitMerge },
                { id: 'EMAIL_CHANGE', label: 'Change Registered Email', icon: Mail },
              ].map(t => {
                const Icon = t.icon;
                const isSelected = requestType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRequestType(t.id)}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 text-slate-300 font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member Reference ID */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Member Reference ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. PATFT-0001"
              value={memberRefId}
              onChange={(e) => setMemberRefId(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Requester Registered Email */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Your Registered Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="The email currently registered for this person or parent"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              You must be able to verify this registered email address with an OTP code.
            </p>
            {requesterEmail && requesterEmail.includes('@') && memberRefId && (
              <div className="pt-2">
                <EmailOtpVerification
                  email={requesterEmail}
                  purpose="EXISTING_MEMBER_EMAIL_VERIFICATION"
                  member_ref_id={memberRefId}
                  label="Verify Registered Member Email"
                  onVerified={(token) => setRequesterOtpToken(token)}
                />
              </div>
            )}
          </div>

          {/* Conditional Fields */}
          {(requestType === 'LINK_MEMBERS' || requestType === 'MERGE_MEMBERS') && (
            <div className="border border-slate-800 bg-slate-950/60 rounded-2xl p-3.5 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Second Party Details (Dual-Mail Verification)
              </span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Member Reference ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PATFT-0002"
                  value={secondaryMemberRefId}
                  onChange={(e) => setSecondaryMemberRefId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Second Member's Registered Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="second.person@example.com"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {requestType === 'EMAIL_CHANGE' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Email Address to Bind *
              </label>
              <input
                type="email"
                required
                placeholder="new.email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Details / Explanation */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Details of Request / Changes Needed *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Minor is now 18 years old, adding contact phone +91 9999999999 and email..."
              value={changeDetails}
              onChange={(e) => setChangeDetails(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Generate Request Ticket</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

