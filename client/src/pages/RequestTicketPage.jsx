import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import { FileText, Mail, CheckCircle2, AlertCircle, ArrowRight, GitMerge, UserCheck, Edit3 } from 'lucide-react';

export default function RequestTicketPage({ onNavigate }) {
  const [requestType, setRequestType] = useState('EDIT_MEMBER'); // EDIT_MEMBER, LINK_MEMBERS, MERGE_MEMBERS, EMAIL_CHANGE
  const [requesterEmail, setRequesterEmail] = useState('');
  const [memberRefId, setMemberRefId] = useState('');
  
  // Specific payloads
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [secondaryMemberRefId, setSecondaryMemberRefId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [changeDetails, setChangeDetails] = useState('');

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
      type: requestType,
      requester_email: requesterEmail.trim(),
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
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900">Ticket Created Successfully!</h2>
        <p className="text-center text-sm text-slate-600 mt-2">
          Your request for <strong>{requestType.replace('_', ' ')}</strong> has been registered.
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
            <span>Email Authentication Requirement</span>
          </div>
          <p>
            Please email <strong className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200">support@familytree.local</strong> with the subject:
          </p>
          <p className="font-mono bg-white p-2 rounded-lg border border-amber-200 text-slate-800 font-semibold select-all">
            Verify Ticket: {ticketResult.ticket_id}
          </p>
          {(requestType === 'LINK_MEMBERS' || requestType === 'MERGE_MEMBERS') && (
            <p className="font-semibold text-amber-950">
              Notice: Both parties ({requesterEmail} and {secondaryEmail}) must independently email the support address referencing this ticket before Admin approval.
            </p>
          )}
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Submit Verification Ticket</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Request profile edits, minor adult promotion, family linkage, or record merge
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ticket Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                    className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member Reference ID */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Member Reference ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. PATFT-0001"
              value={memberRefId}
              onChange={(e) => setMemberRefId(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Requester Registered Email */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Your Registered Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="The email currently registered for this person or parent"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              You must be able to send a verification email from this exact address.
            </p>
          </div>

          {/* Conditional Fields */}
          {(requestType === 'LINK_MEMBERS' || requestType === 'MERGE_MEMBERS') && (
            <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Second Party Details (Dual-Mail Verification)
              </span>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Target Member Reference ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PATFT-0002"
                  value={secondaryMemberRefId}
                  onChange={(e) => setSecondaryMemberRefId(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Second Member's Registered Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="second.person@example.com"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {requestType === 'EMAIL_CHANGE' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                New Email Address to Bind *
              </label>
              <input
                type="email"
                required
                placeholder="new.email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Details / Explanation */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Details of Request / Changes Needed *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Minor is now 18 years old, adding contact phone +91 9999999999 and email..."
              value={changeDetails}
              onChange={(e) => setChangeDetails(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

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
                <span>Generate Request Ticket</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
