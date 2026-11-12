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
import { UserPlus, ShieldCheck, Mail, CheckCircle2, AlertCircle, ArrowRight, Send, Clock, Link2 } from 'lucide-react';

export default function AddMemberPage({ onNavigate, initialParams = {} }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);

  // Relationship section (Top dropdowns per spec)
  const [targetPersonId, setTargetPersonId] = useState('');
  const [relationshipType, setRelationshipType] = useState('SON'); // FATHER, MOTHER, SPOUSE, SON, DAUGHTER
  const [parentEmail, setParentEmail] = useState('');
  const [parentVerified, setParentVerified] = useState(false);
  const [verifyingParent, setVerifyingParent] = useState(false);
  const [parentVerificationError, setParentVerificationError] = useState('');

  // Person fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastNameManuallyEdited, setLastNameManuallyEdited] = useState(false);
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [beforeMarriageSurname, setBeforeMarriageSurname] = useState('');
  const [dob, setDob] = useState(''); // DD/MM/YYYY text field
  const [isDeceased, setIsDeceased] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Minor / Deceased parent link
  const [fatherPersonId, setFatherPersonId] = useState('');
  const [motherPersonId, setMotherPersonId] = useState('');

  const [memberOtpToken, setMemberOtpToken] = useState('');
  const [a4Warning, setA4Warning] = useState({ isOpen: false, message: '', matchedMember: '' });

  // Touched state for displaying inline errors
  const [touched, setTouched] = useState({});

  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);

  const markTouched = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Load surnames on mount
  useEffect(() => {
    apiRequest('/surnames')
      .then(res => {
        const list = res.surnames || [];
        setSurnames(list);
        if (list.length > 0 && initialParams?.surname_ref_id) {
          const preselected = list.find(s => s.surname_ref_id === initialParams.surname_ref_id);
          if (preselected) {
            setSelectedSurnameId(preselected.surname_ref_id);
            if (!lastNameManuallyEdited && preselected.surname_name) {
              setLastName(preselected.surname_name);
            }
            loadFamilyMembers(preselected.surname_ref_id);
          }
        }
      })
      .catch(err => setError(err.message || 'Failed to load lineages'));
  }, [initialParams?.surname_ref_id]);

  const loadFamilyMembers = async (surnameRefId) => {
    if (!surnameRefId) {
      setFamilyMembers([]);
      setTargetPersonId('');
      return;
    }
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
        // Default to founding husband per specification
        const foundingHusband = members.find(
          m => String(m.founding_role).toUpperCase() === 'HUSBAND' || String(m.member_ref_id).endsWith('-0001')
        );
        const defaultTarget = foundingHusband || members[0];
        const defId = defaultTarget.person_id || defaultTarget.member_ref_id || defaultTarget.id;
        setTargetPersonId(defId);
        if (defaultTarget && !defaultTarget.has_registered_email) {
          setParentVerified(true);
        } else {
          setParentVerified(false);
        }

        const father = members.find(m => m.gender === 'Male' || String(m.founding_role).toUpperCase() === 'HUSBAND');
        const mother = members.find(m => m.gender === 'Female' || String(m.founding_role).toUpperCase() === 'WIFE');
        setFatherPersonId(father ? (father.person_id || father.member_ref_id || father.id) : '');
        setMotherPersonId(mother ? (mother.person_id || mother.member_ref_id || mother.id) : '');
      } else {
        setTargetPersonId('');
        setParentVerified(false);
      }
    } catch (err) {
      console.error(err);
      setFamilyMembers([]);
      setTargetPersonId('');
      setParentVerified(false);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTargetPersonChange = (newId) => {
    setTargetPersonId(newId);
    setParentEmail('');
    setParentVerificationError('');
    const m = familyMembers.find(x => (x.person_id || x.member_ref_id || x.id) === newId);
    if (m && !m.has_registered_email) {
      setParentVerified(true);
    } else {
      setParentVerified(false);
    }
  };

  const handleRelationshipChange = (rel) => {
    setRelationshipType(rel);
    if (rel === 'DAUGHTER' || rel === 'MOTHER') {
      setGender('Female');
    } else if (rel === 'SON' || rel === 'FATHER') {
      setGender('Male');
    } else if (rel === 'SPOUSE') {
      setMaritalStatus('Married');
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

  const handleSurnameSelect = (id) => {
    setSelectedSurnameId(id);
    setParentEmail('');
    setParentVerificationError('');
    setParentVerified(false);
    if (!id) {
      setFamilyMembers([]);
      setTargetPersonId('');
      return;
    }
    const found = surnames.find(s => s.surname_ref_id === id);
    if (found && !lastNameManuallyEdited && found.surname_name) {
      setLastName(found.surname_name);
    }
    loadFamilyMembers(id);
  };

  // Validation
  const firstVal = validateName(firstName, true);
  const midVal = validateName(middleName, false);
  const lastVal = validateName(lastName, true);
  const dobVal = parseAndValidateDob(dob);

  const selectedMember = familyMembers.find(
    m => (m.person_id || m.member_ref_id || m.id) === targetPersonId
  );
  const isDirectLinkReady = Boolean(parentVerified && selectedMember?.has_registered_email);

  const isFemaleAndMarried = gender === 'Female' && (relationshipType === 'SPOUSE' || maritalStatus === 'Married');
  const maidenVal = validateName(beforeMarriageSurname, false);

  const isContactVerified = isDeceased || Boolean(memberOtpToken);
  const isAdult = dobVal.valid && dobVal.age >= 18;
  const isAdultAndAlive = !isDeceased && isAdult;

  const emailVal = validateEmail(email, !isDeceased);
  const phoneVal = validatePhone(phone, !isDeceased);

  // Minor or deceased must link to at least one parent
  const minorOrDeceasedParentValid =
    isAdultAndAlive ||
    Boolean(fatherPersonId) ||
    Boolean(motherPersonId) ||
    relationshipType === 'SON' ||
    relationshipType === 'DAUGHTER';

  const isFormValid =
    Boolean(selectedSurnameId) &&
    firstVal.valid &&
    midVal.valid &&
    lastVal.valid &&
    Boolean(targetPersonId) &&
    isContactVerified &&
    dobVal.valid &&
    maidenVal.valid &&
    minorOrDeceasedParentValid;

  const handleSubmit = async (e, proceedAnyway = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isFormValid) {
      setError('Please correct the validation errors in the form.');
      return;
    }

    setLoading(true);
    setError(null);

    const composedFullName = [firstVal.value, midVal.value, lastVal.value]
      .filter(Boolean)
      .join(' ');

    const memberEmail = isAdultAndAlive && emailVal.valid ? emailVal.value : '';
    const memberPhone = isAdultAndAlive && phoneVal.valid ? phoneVal.value : '';
    const maidenSurname = isFemaleAndMarried ? beforeMarriageSurname.trim() : '';

    const payload = {
      type: 'ADD_MEMBER',
      requester_email: memberEmail,
      captcha_token: 'valid',
      payload: {
        surname_ref_id: selectedSurnameId,
        relative_person_id: targetPersonId,
        relative_email: parentEmail.trim(),
        direct_link: isDirectLinkReady,
        relationship_type: relationshipType,
        first_name: firstVal.value,
        middle_name: midVal.value,
        last_name: lastVal.value,
        full_name: composedFullName,
        otp_token: memberOtpToken || '',
        member_otp_token: memberOtpToken || '',
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
          dob: dobVal.value, // YYYY-MM-DD
          is_deceased: isDeceased,
          email: memberEmail,
          phone: memberPhone,
          father_person_id: fatherPersonId || null,
          mother_person_id: motherPersonId || null,
          otp_token: memberOtpToken || ''
        },
        gender,
        dob: dobVal.value,
        is_deceased: isDeceased,
        surname_before_marriage: maidenSurname,
        prior_marriage_surname: maidenSurname,
        email: memberEmail,
        phone: memberPhone,
        father_person_id: fatherPersonId || null,
        mother_person_id: motherPersonId || null,
        relationship: {
          type: relationshipType,
          target_person_id: targetPersonId
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
    if (ticketResult.direct_linked) {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-emerald-200 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900">Directly Linked to Family Tree!</h2>
          <p className="text-center text-sm text-slate-600 mt-2">
            <strong>{firstName} {lastName}</strong> has been verified via relative email ownership and directly added to <strong>{selectedMember?.full_name || 'the family lineage'}</strong>.
          </p>

          <div className="mt-6 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-center">
            <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">Your Permanent Member Reference ID</span>
            <p className="text-2xl font-mono font-extrabold text-emerald-800 mt-1 select-all">
              {ticketResult.member_ref_id}
            </p>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Instant Lineage Verification</p>
            <p>
              Your record was authenticated against registered member email records in Google Sheets and published immediately without administrative delay.
            </p>
          </div>

          <div className="mt-8 flex justify-center space-x-3">
            <button
              onClick={() => onNavigate('tree', { surname_ref_id: selectedSurnameId })}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20"
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
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
            >
              Add Another Member
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900">Exception Request Submitted!</h2>
        <p className="text-center text-sm text-slate-600 mt-2">
          Your request to add <strong>{firstName} {lastName}</strong> has been submitted as an exception for Administrator review.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Your Tracking Ticket ID</span>
          <p className="text-2xl font-mono font-extrabold text-slate-800 mt-1 select-all">
            {ticketResult.ticket_id}
          </p>
        </div>

        <div className="mt-6 p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs sm:text-sm text-slate-700 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Administrator Review Required</span>
          </div>
          <p>
            Your request has been registered with Ticket ID: <strong className="font-mono select-all text-slate-800">{ticketResult.ticket_id}</strong>.
          </p>
          <p className="text-xs text-slate-600">
            The administrator will review your submission and link the member to the family lineage. You can track ticket progress using the button below.
          </p>
        </div>

        <div className="mt-8 flex justify-center space-x-3">
          <button
            onClick={() => onNavigate('ticket-status')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20"
          >
            Track Status
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Add Family Member</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Submit a member record to extend an approved lineage. Permanent Ref ID assigned after Admin approval.
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
          {/* Family Connection Grid: Lineage, Related To, Relationship */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Family Connection
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Family Lineage *
                </label>
                <select
                  value={selectedSurnameId}
                  onChange={(e) => handleSurnameSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Select Family Lineage --</option>
                  {surnames.map((s, idx) => (
                    <option key={s.surname_ref_id} value={s.surname_ref_id}>
                      {s.surname_name}{s.branch_no ? ` - Family ${s.branch_no}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Related To (Existing Member) *
                </label>
                <select
                  value={targetPersonId}
                  onChange={(e) => handleTargetPersonChange(e.target.value)}
                  disabled={!selectedSurnameId || loadingMembers}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  {!selectedSurnameId ? (
                    <option value="">-- Select a family lineage first --</option>
                  ) : loadingMembers ? (
                    <option value="">Loading family members...</option>
                  ) : familyMembers.length === 0 ? (
                    <option value="">No existing members found in this family</option>
                  ) : (
                    <>
                      <option value="">-- Select Family Member --</option>
                      {familyMembers.map(m => {
                        const pId = m.person_id || m.member_ref_id || m.id;
                        return (
                          <option key={pId} value={pId}>
                            {formatMemberDropdownLabel(m, familyMembers)}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Your Relationship to Relative *
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) => handleRelationshipChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="SON">SON</option>
                  <option value="DAUGHTER">DAUGHTER</option>
                  <option value="SPOUSE">SPOUSE</option>
                  <option value="FATHER">FATHER</option>
                  <option value="MOTHER">MOTHER</option>
                </select>
              </div>
            </div>
          </div>

          {/* POST THIS: Verify Relative Email to Link Directly */}
          <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Verify Relative Email to Link Directly
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
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
                className={`flex-1 px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono focus:outline-none ${
                  parentVerified
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : parentVerificationError
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-slate-200'
                }`}
              />
              <button
                type="button"
                onClick={handleVerifyParentEmail}
                disabled={!parentEmail || verifyingParent}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shrink-0 transition shadow-sm"
              >
                {verifyingParent ? 'Verifying...' : parentVerified ? 'Verified' : 'Verify Email'}
              </button>
            </div>

            {parentVerified && (
              <div className="flex items-center gap-1.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verified! Email matches records for {selectedMember?.full_name}. You will be linked directly to this family.</span>
              </div>
            )}

            {parentVerificationError && (
              <div className="flex items-start gap-1.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{parentVerificationError}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    You can still proceed by clicking "Send Request to Admin" below as an exception case.
                  </p>
                </div>
              </div>
            )}

            {selectedMember && !selectedMember.has_registered_email && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                Note: {selectedMember.full_name} does not have an active email on file (deceased or elder record). You can submit this as an exception request for administrator review.
              </div>
            )}
          </div>

          {/* THEN: User Entry Details */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              New Member Details
            </span>

            {/* Step 1: Name, Contact & Deceased status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand"
                  value={firstName}
                  onBlur={() => markTouched('firstName')}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.firstName && !firstVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.firstName && !firstVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{firstVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kumar (optional)"
                  value={middleName}
                  onBlur={() => markTouched('middleName')}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.middleName && !midVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.middleName && !midVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{midVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patil"
                  value={lastName}
                  onBlur={() => markTouched('lastName')}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setLastNameManuallyEdited(true);
                  }}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.lastName && !lastVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.lastName && !lastVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{lastVal.error}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="isDeceased"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="isDeceased" className="text-xs font-medium text-slate-700 cursor-pointer">
                This family member is deceased (no phone/email required; linked by parent identity)
              </label>
            </div>

            {/* If not deceased: Phone, Email & Email OTP Verification */}
            {!isDeceased && (
              <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Contact Identity &amp; Email Verification
                </span>
                <p className="text-xs text-slate-500">
                  Enter your mobile number and email. Email OTP verification is mandatory to unlock remaining details.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210 (10 digits starting with 9, 8, 7, 6)"
                      maxLength={14}
                      value={phone}
                      onBlur={() => markTouched('phone')}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                        touched.phone && !phoneVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    {touched.phone && !phoneVal.valid ? (
                      <p className="text-[11px] text-rose-600 mt-1">{phoneVal.error}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">10 digits starting with 9, 8, 7, or 6</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="member@example.com"
                      value={email}
                      onBlur={() => markTouched('email')}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                        touched.email && !emailVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    {touched.email && !emailVal.valid && (
                      <p className="text-[11px] text-rose-600 mt-1">{emailVal.error}</p>
                    )}
                  </div>

                  <div className="col-span-1 sm:col-span-2 pt-2">
                    <EmailOtpVerification
                      email={email}
                      purpose="NEW_PERSON_EMAIL_VERIFICATION"
                      label="Verify Member Email"
                      disabled={!emailVal.valid || !phoneVal.valid}
                      onVerified={(token) => setMemberOtpToken(token)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Remaining All Details (Unlocked once email is verified or if deceased) */}
            {(isDeceased || memberOtpToken) ? (
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4 animate-in fade-in duration-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Remaining Member Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
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
                      placeholder="DD/MM/YYYY (e.g. 01011985)"
                      maxLength={10}
                      value={dob}
                      onBlur={() => markTouched('dob')}
                      onChange={(e) => setDob(formatDobMask(e.target.value))}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-mono focus:outline-none focus:border-emerald-500 ${
                        touched.dob && !dobVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    {touched.dob && !dobVal.valid && (
                      <p className="text-[11px] text-rose-600 mt-1">{dobVal.error}</p>
                    )}
                  </div>

                  {gender === 'Female' && relationshipType !== 'SPOUSE' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Marital Status *</label>
                      <select
                        value={maritalStatus}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>
                  )}

                  {gender === 'Female' && (relationshipType === 'SPOUSE' || maritalStatus === 'Married') && (
                    <div className={relationshipType === 'SPOUSE' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Prior Marriage Surname (Maiden Name)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kulkarni, Patil"
                        value={beforeMarriageSurname}
                        onChange={(e) => setBeforeMarriageSurname(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Maiden surname before marriage for maternal lineage preservation. Stored in Google Sheets under prior_marriage_surname.
                      </p>
                    </div>
                  )}
                </div>

                {/* Minor / Deceased Parent Linking */}
                {(!isAdult || isDeceased) && (
                  <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Parent Linking (Required for Minors &amp; Deceased)
                    </span>
                    <p className="text-xs text-slate-500">
                      Must link to at least one parent (Father or Mother) in the lineage.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Father</label>
                        <select
                          value={fatherPersonId}
                          onChange={(e) => setFatherPersonId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Father --</option>
                          {familyMembers.map(m => {
                            const pId = m.person_id || m.member_ref_id || m.id;
                            return (
                              <option key={pId} value={pId}>
                                {formatMemberDropdownLabel(m, familyMembers)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Mother</label>
                        <select
                          value={motherPersonId}
                          onChange={(e) => setMotherPersonId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Mother --</option>
                          {familyMembers.map(m => {
                            const pId = m.person_id || m.member_ref_id || m.id;
                            return (
                              <option key={pId} value={pId}>
                                {formatMemberDropdownLabel(m, familyMembers)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 text-slate-600 text-xs">
                <div className="w-8 h-8 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Remaining Details Locked</p>
                  <p className="text-slate-500 mt-0.5">Please verify the member email address with OTP above to enter Date of Birth, Gender, and Prior Marriage Surname.</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className={`w-full py-3.5 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 ${
                isDirectLinkReady
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-slate-800 hover:bg-slate-900 shadow-slate-800/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isDirectLinkReady ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Link to Family (Direct Link)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Request to Admin (Exception Review)</span>
                </>
              )}
            </button>
            {!isDirectLinkReady && (
              <p className="text-[11px] text-center text-slate-500">
                Relative email not verified directly. Submission will be sent to the administrator for manual review.
              </p>
            )}
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
