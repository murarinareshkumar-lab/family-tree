import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import { UserPlus, ShieldCheck, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function AddMemberPage({ onNavigate }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);
  
  // Person fields
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
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

  // Load surnames on mount
  useEffect(() => {
    apiRequest('/surnames')
      .then(res => {
        const list = res.surnames || [];
        setSurnames(list);
        if (list.length > 0) {
          setSelectedSurnameId(list[0].surname_ref_id);
          loadFamilyMembers(list[0].surname_ref_id);
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
    loadFamilyMembers(id);
  };

  // Determine if minor (under 18)
  const isMinor = () => {
    if (!dob) return false;
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    return (currentYear - birthYear) < 18;
  };

  const isAdultAndAlive = !isDeceased && !isMinor();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaVerified) {
      setError('Please complete the anti-bot verification check.');
      return;
    }

    if (isAdultAndAlive && (!email || !phone)) {
      setError('Adult living members must provide a verified Email and Phone number.');
      return;
    }

    if (!targetPersonId) {
      setError('Please select an existing family member to connect this person to.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      type: 'ADD_MEMBER',
      requester_email: email || 'family-guardian@local',
      captcha_token: 'valid',
      payload: {
        surname_ref_id: selectedSurnameId,
        full_name: fullName.trim(),
        gender,
        dob,
        is_deceased: isDeceased,
        email: email.trim(),
        phone: phone.trim(),
        father_person_id: fatherPersonId || null,
        mother_person_id: motherPersonId || null,
        relationship: {
          type: relationshipType, // FATHER, MOTHER, SPOUSE, SON, DAUGHTER
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
          Your request to add <strong>{fullName}</strong> has been logged. Sequence ID will be assigned safely upon Admin approval.
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
            <span>Email Authentication Step</span>
          </div>
          <p>
            Please email <strong className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200">support@familytree.local</strong> with the subject:
          </p>
          <p className="font-mono bg-white p-2 rounded-lg border border-amber-200 text-slate-800 font-semibold select-all">
            Verify Ticket: {ticketResult.ticket_id}
          </p>
          <p className="text-xs text-amber-700">
            {isAdultAndAlive ? 'Send from the member\'s registered email.' : 'Send from the registered guardian or parent\'s email.'}
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Add Family Member</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Connect a child, spouse, or parent to an existing family lineage
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Patil"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
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
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
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
