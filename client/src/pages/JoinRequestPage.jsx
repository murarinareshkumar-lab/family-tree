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
import { formatMemberDropdownLabel } from '../utils/memberDropdown';
import { UserCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Send, Clock, Link2 } from 'lucide-react';

export default function JoinRequestPage({ onNavigate, initialParams = {} }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);

  // Relative selection
  const [targetPersonId, setTargetPersonId] = useState('');
  const [relationshipType, setRelationshipType] = useState('CHILD_OF');
  const [parentEmail, setParentEmail] = useState('');
  const [parentVerified, setParentVerified] = useState(false);
  const [verifyingParent, setVerifyingParent] = useState(false);
  const [parentVerificationError, setParentVerificationError] = useState('');

  // Visitor fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [beforeMarriageSurname, setBeforeMarriageSurname] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
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
        if (list.length > 0 && initialParams?.surname_ref_id) {
          const preselected = list.find(s => s.surname_ref_id === initialParams.surname_ref_id);
          if (preselected) {
            setSelectedSurnameId(preselected.surname_ref_id);
            if (preselected.surname_name) {
              setLastName(preselected.surname_name);
            }
            loadFamilyMembers(preselected.surname_ref_id);
          }
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
      setTargetPersonId('');
      setParentVerified(false);
      setParentVerificationError('');
    } catch (_) {
      setFamilyMembers([]);
      setTargetPersonId('');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleVerifyParentEmail = async () => {
    if (!parentEmail || !parentEmail.includes('@')) {
      setParentVerificationError('Please enter a valid email address.');
      return;
    }
    setVerifyingParent(true);
    setParentVerificationError('');
    try {
      const res = await apiRequest('/families/verify-member-email', {
        method: 'POST',
        body: JSON.stringify({
          person_id: targetPersonId,
          email: parentEmail.trim()
        })
      });
      if (res.verified && res.direct_link_eligible) {
        setParentVerified(true);
        setParentVerificationError('');
      } else {
        setParentVerified(false);
        setParentVerificationError(res.message || res.error || 'Verification failed. You can submit this as an exception request for admin review.');
      }
    } catch (err) {
      setParentVerified(false);
      setParentVerificationError(err.message || 'The email entered does not match our records for this family member. You can submit this as an exception request for admin review.');
    } finally {
      setVerifyingParent(false);
    }
  };

  const handleSurnameChange = (newSurnameId) => {
    setSelectedSurnameId(newSurnameId);
    setParentEmail('');
    setParentVerificationError('');
    setParentVerified(false);
    if (!newSurnameId) {
      setFamilyMembers([]);
      setTargetPersonId('');
      return;
    }
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

  const selectedMember = familyMembers.find(
    m => (m.person_id || m.member_ref_id || m.id) === targetPersonId
  );
  const isDirectLinkReady = Boolean(parentVerified && selectedMember?.has_registered_email);

  const isFemaleAndMarried = gender === 'Female' && (relationshipType === 'SPOUSE_OF' || maritalStatus === 'Married');
  const maidenVal = validateName(beforeMarriageSurname, false);

  const isFormValid =
    Boolean(selectedSurnameId) &&
    firstVal.valid &&
    midVal.valid &&
    lastVal.valid &&
    dobVal.valid &&
    maidenVal.valid &&
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

    const maidenSurname = isFemaleAndMarried ? beforeMarriageSurname.trim() : '';

    const payload = {
      type: 'JOIN_REQUEST',
      requester_email: isDeceased ? '' : (emailVal.valid ? emailVal.value : ''),
      captcha_token: 'valid',
      payload: {
        surname_ref_id: selectedSurnameId,
        relative_person_id: targetPersonId,
        relative_email: parentEmail.trim(),
        direct_link: isDirectLinkReady,
        relationship_type: relationshipType,
        otp_token: isDeceased ? '' : otpToken,
        proceed_anyway: proceedAnyway,
        person: {
          first_name: firstVal.value,
          middle_name: midVal.value,
          last_name: lastVal.value,
          full_name: composedFullName,
          gender,
          marital_status: isFemaleAndMarried ? 'Married' : maritalStatus,
          surname_before_marriage: maidenSurname,
          prior_marriage_surname: maidenSurname,
          occupation: occupation.trim(),
          location: location.trim(),
          dob: dobVal.value,
          is_deceased: Boolean(isDeceased),
          email: isDeceased ? '' : (emailVal.valid ? emailVal.value : ''),
          phone: isDeceased ? '' : (phoneVal.valid ? phoneVal.value : ''),
          otp_token: isDeceased ? '' : otpToken
        },
        surname_before_marriage: maidenSurname,
        prior_marriage_surname: maidenSurname,
        occupation: occupation.trim(),
        location: location.trim()
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
    if (ticketResult.direct_linked) {
      return (
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl border border-blue-800/80 p-6 sm:p-8 shadow-sm text-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-blue-950 text-blue-400 flex items-center justify-center mx-auto mb-3.5 border border-blue-800/80">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-center text-white">Directly Linked to Family Tree!</h2>
          <p className="text-center text-xs sm:text-sm text-slate-300 mt-2">
            <strong>{firstName} {lastName}</strong> has been verified via relative email ownership and directly added to <strong>{selectedMember?.full_name || 'the family lineage'}</strong>.
          </p>

          <div className="mt-5 p-3.5 bg-blue-950/60 rounded-xl border border-blue-800 text-center">
            <span className="text-[11px] uppercase tracking-wider text-blue-400 font-bold">Your Permanent Member Reference ID</span>
            <p className="text-xl sm:text-2xl font-mono font-extrabold text-blue-300 mt-1 select-all">
              {ticketResult.member_ref_id}
            </p>
          </div>

          <div className="mt-5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">Instant Lineage Verification</p>
            <p>
              Your record was authenticated against registered member email records in Google Sheets and published immediately without administrative delay.
            </p>
          </div>

          <div className="mt-6 flex justify-center space-x-3">
            <button
              onClick={() => onNavigate && onNavigate('tree', { surname_ref_id: selectedSurnameId })}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
            >
              View in Family Tree
            </button>
            <button
              onClick={() => {
                setTicketResult(null);
                setFirstName('');
                setMiddleName('');
                setParentEmail('');
                setParentVerified(false);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-slate-700"
            >
              Submit Another
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-sm text-slate-100">
        <div className="w-14 h-14 rounded-2xl bg-amber-950 text-amber-400 flex items-center justify-center mx-auto mb-3.5 border border-amber-800">
          <Clock className="w-7 h-7" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-center text-white">Exception Request Submitted!</h2>
        <p className="text-center text-xs sm:text-sm text-slate-300 mt-2">
          Your request to join the family tree has been submitted as an exception for Administrator review.
        </p>

        <div className="mt-5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Your Tracking Ticket ID</span>
          <p className="text-xl sm:text-2xl font-mono font-extrabold text-white mt-1 select-all">
            {ticketResult.ticket_id}
          </p>
        </div>

        <div className="mt-5 p-4 bg-amber-950/60 border border-amber-800 rounded-xl text-xs sm:text-sm text-slate-300 space-y-1.5">
          <div className="flex items-center space-x-2 font-bold text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Administrator Review Required</span>
          </div>
          <p>
            Your request has been registered with Ticket ID: <strong className="font-mono select-all text-white">{ticketResult.ticket_id}</strong>.
          </p>
          <p className="text-xs text-slate-400">
            The administrator will review your submission and link you to the family lineage. You can track ticket progress using Track Ticket.
          </p>
        </div>

        <div className="mt-6 flex justify-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('ticket-status')}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm"
          >
            Track Status
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('tree')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition border border-slate-700"
          >
            Return to Family Tree
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-sm text-slate-100">
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-blue-950 text-blue-400 border border-blue-800/80 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Join the Family Tree</h1>
            <p className="text-xs text-slate-400">
              Submit a request to add yourself to an existing family branch.
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
          {/* Step 1: Lineage & Relative Connection */}
          <div className="border border-slate-800 bg-slate-950/60 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Family Connection
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Select Family Lineage *
                </label>
                <select
                  value={selectedSurnameId}
                  onChange={(e) => handleSurnameChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Family Lineage --</option>
                  {surnames.map(s => (
                    <option key={s.surname_ref_id} value={s.surname_ref_id}>
                      {s.surname_name}{s.branch_no ? ` - Family ${s.branch_no}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Relative *</label>
                <select
                  value={targetPersonId}
                  onChange={(e) => setTargetPersonId(e.target.value)}
                  disabled={!selectedSurnameId || loadingMembers}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-slate-100 focus:outline-none focus:border-blue-500 disabled:bg-slate-800/50 disabled:cursor-not-allowed"
                >
                  {!selectedSurnameId ? (
                    <option value="">-- Select a family lineage first --</option>
                  ) : loadingMembers ? (
                    <option value="">Loading members...</option>
                  ) : familyMembers.length === 0 ? (
                    <option value="">No members found in this family</option>
                  ) : (
                    <>
                      <option value="">-- Select Relative --</option>
                      {familyMembers.map(m => (
                        <option key={m.person_id || m.id} value={m.person_id || m.id}>
                          {formatMemberDropdownLabel(m, familyMembers)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Your Relationship to Relative *</label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="CHILD_OF">Child of this person (Son/Daughter)</option>
                  <option value="SPOUSE_OF">Spouse of this person (Husband/Wife)</option>
                  <option value="SIBLING_OF">Sibling of this person (Brother/Sister)</option>
                  <option value="PARENT_OF">Parent of this person (Father/Mother)</option>
                </select>
              </div>
            </div>
          </div>

          {/* POST THIS: Verify Relative Email to Link Directly */}
          <div className="border border-slate-800 bg-slate-950/60 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Verify Relative Email to Link Directly
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              To link directly without waiting for admin approval, enter the registered &amp; verified email address of <strong>{selectedMember?.full_name || 'the selected family member'}</strong>.
            </p>

            <div className="flex gap-2 pt-1">
              <input
                type="email"
                placeholder={`Enter ${selectedMember?.full_name || 'relative'}'s verified email`}
                value={parentEmail}
                onChange={(e) => {
                  setParentEmail(e.target.value);
                  setParentVerified(false);
                  setParentVerificationError('');
                }}
                className={`flex-1 px-3 py-2 bg-slate-900 border rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none ${
                  parentVerified
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : parentVerificationError
                    ? 'border-rose-400 bg-rose-950/30'
                    : 'border-slate-700'
                }`}
              />
              <button
                type="button"
                onClick={handleVerifyParentEmail}
                disabled={!parentEmail || verifyingParent}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold rounded-xl shrink-0 transition shadow-xs"
              >
                {verifyingParent ? 'Verifying...' : parentVerified ? 'Verified' : 'Verify Email'}
              </button>
            </div>

            {parentVerified && (
              <div className="flex items-center gap-1.5 p-2.5 bg-emerald-950/70 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verified! Email matches records for {selectedMember?.full_name}. You will be linked directly to this family.</span>
              </div>
            )}

            {parentVerificationError && (
              <div className="flex items-start gap-1.5 p-2.5 bg-amber-950/70 border border-amber-800 rounded-xl text-amber-200 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{parentVerificationError}</p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    You can still proceed by clicking "Send Request to Admin" below as an exception case.
                  </p>
                </div>
              </div>
            )}

            {selectedMember && !selectedMember.has_registered_email && (
              <div className="p-2.5 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-300 text-xs">
                Note: {selectedMember.full_name} does not have an active email on file (deceased or elder record). You can submit this as an exception request for administrator review.
              </div>
            )}
          </div>

          {/* THEN: User Entry Details */}
          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Your Personal Details
            </span>

            {/* Step 1: Name, Contact & Deceased status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh"
                  value={firstName}
                  onBlur={() => markTouched('first')}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kumar (optional)"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patil"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-0.5 pb-0.5">
              <input
                type="checkbox"
                id="isDeceased"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-900 rounded border-slate-700 focus:ring-blue-500"
              />
              <label htmlFor="isDeceased" className="text-xs font-medium text-slate-300 cursor-pointer">
                This family member is deceased (no phone/email required; linked by parent identity)
              </label>
            </div>

            {!isDeceased && (
              <div className="border border-slate-800 bg-slate-950/70 rounded-2xl p-3.5 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Contact Identity &amp; Email Verification
                </span>
                <p className="text-xs text-slate-400">
                  Enter your mobile number and email. Email OTP verification is mandatory to unlock remaining details.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210 (10 digits starting with 9, 8, 7, 6)"
                      maxLength={14}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    {!phoneVal.valid && phone ? (
                      <p className="text-[11px] text-rose-400 mt-1">{phoneVal.error}</p>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-0.5">10 digits starting with 9, 8, 7, or 6</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 pt-1">
                    <EmailOtpVerification
                      email={email}
                      purpose="NEW_PERSON_EMAIL_VERIFICATION"
                      label="Verify Your Email Address"
                      disabled={!emailVal.valid || !phoneVal.valid}
                      onVerified={(token) => setOtpToken(token)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Remaining All Details (Unlocked once email is verified or if deceased) */}
            {(isDeceased || otpToken) ? (
              <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/60 space-y-3.5 animate-in fade-in duration-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Remaining Details (Personal &amp; Occupation)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth (DD/MM/YYYY) *</label>
                    <input
                      type="text"
                      required
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      value={dob}
                      onChange={(e) => setDob(formatDobMask(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Occupation / Profession</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineer, Business, Doctor"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore, London"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {gender === 'Female' && relationshipType !== 'SPOUSE_OF' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Marital Status *</label>
                      <select
                        value={maritalStatus}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>
                  )}

                  {gender === 'Female' && (relationshipType === 'SPOUSE_OF' || maritalStatus === 'Married') && (
                    <div className={relationshipType === 'SPOUSE_OF' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Prior Marriage Surname (Maiden Name)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kulkarni, Patil"
                        value={beforeMarriageSurname}
                        onChange={(e) => setBeforeMarriageSurname(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Maiden surname before marriage for maternal lineage preservation. Stored in Google Sheets under prior_marriage_surname.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center space-x-3 text-slate-400 text-xs">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-200">Remaining Details Locked</p>
                  <p className="text-slate-400 mt-0.5">Please verify your email address with OTP above to enter Date of Birth, Gender, Occupation, and Prior Marriage Surname.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {!isDirectLinkReady ? (
              <p className="text-[11px] text-slate-400">
                Relative email not verified directly. Submission will be sent to the administrator for manual review.
              </p>
            ) : <div />}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className={`px-6 py-2.5 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 shrink-0 ${
                isDirectLinkReady
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isDirectLinkReady ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Link to Tree (Direct Link)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Request to Admin (Exception Review)</span>
                </>
              )}
            </button>
          </div>
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
