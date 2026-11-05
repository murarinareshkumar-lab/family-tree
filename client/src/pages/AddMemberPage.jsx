import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import {
  validateName,
  validateEmail,
  validatePhone,
  formatDobMask,
  parseAndValidateDob
} from '../utils/validation';
import { UserPlus, ShieldCheck, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function AddMemberPage({ onNavigate }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);

  // Person fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastNameManuallyEdited, setLastNameManuallyEdited] = useState(false);
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState(''); // DD/MM/YYYY text field
  const [isDeceased, setIsDeceased] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Touched state for displaying inline errors
  const [touched, setTouched] = useState({});

  // Relationship
  const [targetPersonId, setTargetPersonId] = useState('');
  const [relationshipType, setRelationshipType] = useState('SON'); // FATHER, MOTHER, SPOUSE, SON, DAUGHTER

  // Minor / Deceased parent link
  const [fatherPersonId, setFatherPersonId] = useState('');
  const [motherPersonId, setMotherPersonId] = useState('');

  const [captchaVerified, setCaptchaVerified] = useState(false);
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
        if (list.length > 0) {
          const first = list[0];
          setSelectedSurnameId(first.surname_ref_id);
          if (!lastNameManuallyEdited && first.surname_name) {
            setLastName(first.surname_name);
          }
          loadFamilyMembers(first.surname_ref_id);
        }
      })
      .catch(err => setError(err.message || 'Failed to load lineages'));
  }, []);

  const loadFamilyMembers = async (surnameRefId) => {
    if (!surnameRefId) return;
    setLoadingMembers(true);
    try {
      const res = await apiRequest(`/tree?surname_ref_id=${encodeURIComponent(surnameRefId)}`);
      const members = res.members || [];
      setFamilyMembers(members);
      if (members.length > 0) {
        setTargetPersonId(members[0].person_id);
        setFatherPersonId(members.find(m => m.gender === 'Male')?.person_id || '');
        setMotherPersonId(members.find(m => m.gender === 'Female')?.person_id || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSurnameSelect = (id) => {
    setSelectedSurnameId(id);
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

  const isAdult = dobVal.valid && dobVal.age >= 18;
  const isAdultAndAlive = !isDeceased && isAdult;

  const emailVal = validateEmail(email, isAdultAndAlive);
  const phoneVal = validatePhone(phone, isAdultAndAlive);

  const isFormValid =
    Boolean(selectedSurnameId) &&
    firstVal.valid &&
    midVal.valid &&
    lastVal.valid &&
    dobVal.valid &&
    Boolean(targetPersonId) &&
    (isAdultAndAlive ? (emailVal.valid && phoneVal.valid) : true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      setError('Please correct the validation errors in the form.');
      return;
    }

    if (!captchaVerified) {
      setError('Please complete the anti-bot verification check.');
      return;
    }

    setLoading(true);
    setError(null);

    const composedFullName = [firstVal.value, midVal.value, lastVal.value]
      .filter(Boolean)
      .join(' ');

    const payload = {
      type: 'ADD_MEMBER',
      requester_email: isAdultAndAlive ? emailVal.value : (email || 'family-guardian@local'),
      captcha_token: 'valid',
      payload: {
        surname_ref_id: selectedSurnameId,
        first_name: firstVal.value,
        middle_name: midVal.value,
        last_name: lastVal.value,
        full_name: composedFullName,
        person: {
          first_name: firstVal.value,
          middle_name: midVal.value,
          last_name: lastVal.value,
          full_name: composedFullName,
          gender,
          dob: dobVal.value, // YYYY-MM-DD
          is_deceased: isDeceased,
          email: emailVal.valid ? emailVal.value : '',
          phone: phoneVal.valid ? phoneVal.value : '',
          father_person_id: fatherPersonId || null,
          mother_person_id: motherPersonId || null
        },
        gender,
        dob: dobVal.value,
        is_deceased: isDeceased,
        email: emailVal.valid ? emailVal.value : '',
        phone: phoneVal.valid ? phoneVal.value : '',
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
        <h2 className="text-2xl font-bold text-center text-slate-900">Member Request Submitted!</h2>
        <p className="text-center text-sm text-slate-600 mt-2">
          Your request to add <strong>{firstName} {lastName}</strong> has been created. Permanent Ref ID will be assigned upon Administrator approval.
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
            <span>Identity Verification Step</span>
          </div>
          <p>
            Please send an email from {isAdultAndAlive ? <strong>{email}</strong> : 'your registered family guardian address'} to support:
          </p>
          <p className="font-mono bg-white p-2 rounded-lg border border-amber-200 text-slate-800 font-semibold select-all">
            support@familytree.local
          </p>
          <p>
            With the subject: <strong className="font-mono select-all">Verify Ticket: {ticketResult.ticket_id}</strong>
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
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Add Family Member</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Submit a request to add a new relative to an existing verified lineage.
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
          {/* Lineage selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Select Family Lineage *
            </label>
            <select
              value={selectedSurnameId}
              onChange={(e) => handleSurnameSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {surnames.map(s => (
                <option key={s.surname_ref_id} value={s.surname_ref_id}>
                  {s.surname_name} ({s.surname_ref_id})
                </option>
              ))}
            </select>
          </div>

          {/* Member Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
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
          </div>

          {/* Contact Details (Only if adult & alive) */}
          {isAdultAndAlive ? (
            <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Adult Contact Identity (18+ & Living)
              </span>
              <p className="text-xs text-slate-500">
                Email and phone serve as unique personal identity to prevent duplicates.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    maxLength={14}
                    value={phone}
                    onBlur={() => markTouched('phone')}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                      touched.phone && !phoneVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  />
                  {touched.phone && !phoneVal.valid && (
                    <p className="text-[11px] text-rose-600 mt-1">{phoneVal.error}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Minor / Deceased Identity (Parent Linking)
              </span>
              <p className="text-xs text-slate-500">
                Identified by full name + linked parent person ID in Google Sheets.
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
                    {familyMembers.filter(m => m.gender === 'Male').map(m => (
                      <option key={m.person_id} value={m.person_id}>
                        {m.full_name} ({m.member_ref_id})
                      </option>
                    ))}
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
                    {familyMembers.filter(m => m.gender === 'Female').map(m => (
                      <option key={m.person_id} value={m.person_id}>
                        {m.full_name} ({m.member_ref_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Relationship Connection */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Relationship to Family
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">This person is the</label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="SON">SON</option>
                  <option value="DAUGHTER">DAUGHTER</option>
                  <option value="SPOUSE">SPOUSE</option>
                  <option value="FATHER">FATHER</option>
                  <option value="MOTHER">MOTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">of existing member</label>
                <select
                  value={targetPersonId}
                  onChange={(e) => setTargetPersonId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                >
                  {familyMembers.map(m => (
                    <option key={m.person_id} value={m.person_id}>
                      {m.full_name} ({m.member_ref_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Auto-mapped to canonical PARENT_OF or SPOUSE_OF links. Brother, uncle, cousin are dynamically calculated on read.
            </p>
          </div>

          {/* Bot Protection */}
          <CaptchaWidget verified={captchaVerified} onVerify={setCaptchaVerified} />

          <button
            type="submit"
            disabled={!isFormValid || !captchaVerified || loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Submit Member Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
