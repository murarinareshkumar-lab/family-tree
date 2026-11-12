import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import EmailOtpVerification from '../components/EmailOtpVerification';
import A4WarningModal from '../components/A4WarningModal';
import {
  validateName,
  validateEmail,
  validatePhone,
  formatDobMask,
  parseAndValidateDob
} from '../utils/validation';
import { UserCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export default function JoinRequestPage({ onNavigate, initialParams = {} }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);

  // Relative selection
  const [targetPersonId, setTargetPersonId] = useState('');
  const [relationshipType, setRelationshipType] = useState('CHILD_OF');

  // Visitor fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);

  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);
  const [a4Warning, setA4Warning] = useState({ isOpen: false, message: '', matchedMember: '' });

  const markTouched = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    apiRequest('/surnames')
      .then(res => {
        const list = res.surnames || [];
        setSurnames(list);
        if (list.length > 0) {
          const preselected = initialParams?.surname_ref_id
            ? list.find(s => s.surname_ref_id === initialParams.surname_ref_id)
            : null;
          const chosen = preselected || list[0];
          setSelectedSurnameId(chosen.surname_ref_id);
          if (chosen.surname_name) {
            setLastName(chosen.surname_name);
          }
          loadFamilyMembers(chosen.surname_ref_id);
        }
      })
      .catch(err => setError(err.message || 'Failed to load lineages'));
  }, [initialParams?.surname_ref_id]);

  const loadFamilyMembers = async (surnameRefId) => {
    if (!surnameRefId) return;
    setLoadingMembers(true);
    try {
      let members = [];
      try {
        const res = await apiRequest(`/families/members?ref=${encodeURIComponent(surnameRefId)}`);
        members = res.members || [];
      } catch (_) {
        const res2 = await apiRequest(`/tree?surname_ref_id=${encodeURIComponent(surnameRefId)}`);
        members = res2.members || [];
      }
      setFamilyMembers(members);
      if (members.length > 0) {
        setTargetPersonId(members[0].person_id || members[0].id);
      }
    } catch (_) {
      setFamilyMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSurnameChange = (newSurnameId) => {
    setSelectedSurnameId(newSurnameId);
    const s = surnames.find(x => x.surname_ref_id === newSurnameId);
    if (s && s.surname_name) {
      setLastName(s.surname_name);
    }
    loadFamilyMembers(newSurnameId);
  };

  // Validations
  const firstVal = validateName(firstName, true);
  const midVal = validateName(middleName, false);
  const lastVal = validateName(lastName, true);
  const dobVal = parseAndValidateDob(dob, { minAge: isDeceased ? 0 : 0 });
  const emailVal = validateEmail(email, !isDeceased);
  const phoneVal = validatePhone(phone, !isDeceased);

  const isFormValid =
    firstVal.valid &&
    midVal.valid &&
    lastVal.valid &&
    dobVal.valid &&
    (isDeceased ? true : (emailVal.valid && phoneVal.valid && Boolean(otpToken))) &&
    Boolean(targetPersonId);

  const handleSubmit = async (e, proceedAnyway = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);

    const composedFullName = [firstVal.value, midVal.value, lastVal.value]
      .filter(Boolean)
      .join(' ');

    const payload = {
      type: 'JOIN_REQUEST',
      requester_email: isDeceased ? '' : (emailVal.valid ? emailVal.value : ''),
      captcha_token: 'valid',
      payload: {
        surname_ref_id: selectedSurnameId,
        relative_person_id: targetPersonId,
        relationship_type: relationshipType,
        otp_token: isDeceased ? '' : otpToken,
        proceed_anyway: proceedAnyway,
        person: {
          first_name: firstVal.value,
          middle_name: midVal.value,
          last_name: lastVal.value,
          full_name: composedFullName,
          gender,
          dob: dobVal.value,
          is_deceased: Boolean(isDeceased),
          email: isDeceased ? '' : (emailVal.valid ? emailVal.value : ''),
          phone: isDeceased ? '' : (phoneVal.valid ? phoneVal.value : ''),
          otp_token: isDeceased ? '' : otpToken
        }
      }
    };

    try {
      const res = await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.warning && res.code === 'A4_FAMILY_MATCH') {
        setA4Warning({
          isOpen: true,
          message: res.message,
          matchedMember: res.matched_member
        });
        return;
      }

      setA4Warning({ isOpen: false, message: '', matchedMember: '' });
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
        <h2 className="text-2xl font-bold text-center text-slate-900">Join Request Submitted!</h2>
        <p className="text-center text-sm text-slate-600 mt-2">
          Your request to join the family tree has been recorded. Once approved by the administrator, your record will be linked to the tree.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Your Tracking Ticket ID</span>
          <p className="text-2xl font-mono font-extrabold text-emerald-700 mt-1 select-all">
            {ticketResult.ticket_id}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('tree')}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
          >
            Return to Family Tree
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Join the Family Tree</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Submit a request to add yourself to an existing family branch.
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
          {/* Step 1: Select Family Lineage */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Family Lineage *
            </label>
            <select
              value={selectedSurnameId}
              onChange={(e) => handleSurnameChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-blue-500"
            >
              {surnames.map(s => (
                <option key={s.surname_ref_id} value={s.surname_ref_id}>
                  {s.surname_name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Listed Relative and Relationship */}
          <div className="border border-slate-200 bg-slate-50/60 rounded-2xl p-4 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Your Relative in the Tree
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select Relative *</label>
                <select
                  value={targetPersonId}
                  onChange={(e) => setTargetPersonId(e.target.value)}
                  disabled={loadingMembers}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  {familyMembers.length === 0 ? (
                    <option value="">{loadingMembers ? 'Loading members...' : 'No members found'}</option>
                  ) : (
                    familyMembers.map(m => (
                      <option key={m.person_id || m.id} value={m.person_id || m.id}>
                        {m.display_name || m.name || m.full_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Your Relationship to Relative *</label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="CHILD_OF">Child of this person (Son/Daughter)</option>
                  <option value="SPOUSE_OF">Spouse of this person (Husband/Wife)</option>
                  <option value="SIBLING_OF">Sibling of this person (Brother/Sister)</option>
                  <option value="PARENT_OF">Parent of this person (Father/Mother)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Visitor Personal Details */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Your Personal Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh"
                  value={firstName}
                  onBlur={() => markTouched('first')}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kumar"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patil"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth (DD/MM/YYYY) *</label>
                <input
                  type="text"
                  required
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  value={dob}
                  onChange={(e) => setDob(formatDobMask(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="isDeceased"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isDeceased" className="text-xs font-medium text-slate-700 cursor-pointer">
                This family member is deceased (no phone/email required; linked by parent identity)
              </label>
            </div>

            {!isDeceased && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210 (10 digits starting with 9, 8, 7, 6)"
                      maxLength={14}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                    {!phoneVal.valid && phone ? (
                      <p className="text-[11px] text-rose-600 mt-1">{phoneVal.error}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">10 digits starting with 9, 8, 7, or 6</p>
                    )}
                  </div>
                </div>

                {/* Email OTP Verification */}
                <div className="pt-2">
                  <EmailOtpVerification
                    email={email}
                    purpose="NEW_PERSON_EMAIL_VERIFICATION"
                    label="Verify Your Email Address"
                    disabled={!emailVal.valid || !phoneVal.valid}
                    disabledReason={
                      !emailVal.valid && !phoneVal.valid
                        ? 'Enter a valid email address and a valid 10-digit phone number (starting with 6, 7, 8, or 9) to enable email verification.'
                        : !phoneVal.valid
                        ? 'Enter a valid 10-digit phone number (starting with 6, 7, 8, or 9) to enable email verification.'
                        : !emailVal.valid
                        ? 'Enter a valid email address to enable email verification.'
                        : ''
                    }
                    onVerified={(token) => setOtpToken(token)}
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Submit Join Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <A4WarningModal
          isOpen={a4Warning.isOpen}
          message={a4Warning.message}
          matchedMember={a4Warning.matchedMember}
          onGoBack={() => setA4Warning({ isOpen: false, message: '', matchedMember: '' })}
          onProceedAnyway={() => {
            setA4Warning({ isOpen: false, message: '', matchedMember: '' });
            handleSubmit(null, true);
          }}
        />
      </div>
    </div>
  );
}
