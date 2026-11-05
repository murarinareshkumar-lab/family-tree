import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import {
  validateName,
  validateEmail,
  validatePhone,
  formatDobMask,
  parseAndValidateDob
} from '../utils/validation';
import {
  PlusCircle,
  Search,
  RotateCcw,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserCheck,
  ShieldCheck
} from 'lucide-react';

export default function OnboardSurnamePage({ onNavigate }) {
  const [surnameName, setSurnameName] = useState('');

  // Search state
  const [lastSearchedSurname, setLastSearchedSurname] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHasPending, setSearchHasPending] = useState(false);
  const [searchPendingMessage, setSearchPendingMessage] = useState(null);
  const [familyChoice, setFamilyChoice] = useState('different_family');

  // Husband details
  const [husbandFirstName, setHusbandFirstName] = useState('');
  const [husbandMiddleName, setHusbandMiddleName] = useState('');
  const [husbandEmail, setHusbandEmail] = useState('');
  const [husbandPhone, setHusbandPhone] = useState('');
  const [husbandDob, setHusbandDob] = useState(''); // Raw input DD/MM/YYYY

  // Wife details
  const [wifeFirstName, setWifeFirstName] = useState('');
  const [wifeMiddleName, setWifeMiddleName] = useState('');
  const [wifeLastName, setWifeLastName] = useState('');
  const [wifeLastNameManuallyEdited, setWifeLastNameManuallyEdited] = useState(false);
  const [wifeEmail, setWifeEmail] = useState('');
  const [wifePhone, setWifePhone] = useState('');
  const [wifeDob, setWifeDob] = useState(''); // Raw input DD/MM/YYYY

  // Touched state for displaying inline errors once user interacts
  const [touched, setTouched] = useState({});

  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);

  const markTouched = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSurnameChange = (val) => {
    setSurnameName(val);
    if (!wifeLastNameManuallyEdited) {
      setWifeLastName(val);
    }
  };

  // Perform search with automatic fallback to guarantee route availability
  const handleSearchSurname = async () => {
    const q = surnameName.trim();
    if (q.length < 3) return;

    setSearchLoading(true);
    setSearchFailed(false);
    try {
      let res;
      try {
        res = await apiRequest(`/surnames/search?q=${encodeURIComponent(q)}`);
      } catch (err404) {
        // Fallback to /api/surnames?q= if nested route rewrite is delayed
        res = await apiRequest(`/surnames?q=${encodeURIComponent(q)}`);
      }

      setLastSearchedSurname(q);
      setSearchCompleted(true);
      setSearchHasPending(Boolean(res.has_pending_request));
      setSearchPendingMessage(res.pending_message || null);
      setSearchResults(res.results || []);
      if ((res.results || []).length > 0) {
        setFamilyChoice('different_family');
      }
    } catch (_) {
      setSearchFailed(true);
      setSearchCompleted(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // Validation evaluations
  const surnameVal = validateName(surnameName, true);
  const hFirstVal = validateName(husbandFirstName, true);
  const hMidVal = validateName(husbandMiddleName, false);
  const hLastVal = validateName(surnameName, true);
  const hEmailVal = validateEmail(husbandEmail, true);
  const hPhoneVal = validatePhone(husbandPhone, true);
  const hDobVal = parseAndValidateDob(husbandDob, { minAge: 18 });

  const wFirstVal = validateName(wifeFirstName, true);
  const wMidVal = validateName(wifeMiddleName, false);
  const wLastVal = validateName(wifeLastName, true);
  const wEmailVal = validateEmail(wifeEmail, true);
  const wPhoneVal = validatePhone(wifePhone, true);
  const wDobVal = parseAndValidateDob(wifeDob, { minAge: 18 });

  const isFormValid =
    surnameVal.valid &&
    hFirstVal.valid &&
    hMidVal.valid &&
    hLastVal.valid &&
    hEmailVal.valid &&
    hPhoneVal.valid &&
    hDobVal.valid &&
    wFirstVal.valid &&
    wMidVal.valid &&
    wLastVal.valid &&
    wEmailVal.valid &&
    wPhoneVal.valid &&
    wDobVal.valid;

  // Search required before submit rule
  const isSearchValid =
    searchCompleted &&
    !searchFailed &&
    surnameName.trim() === lastSearchedSurname &&
    surnameName.trim().length >= 3;

  const canSubmit = isFormValid && isSearchValid && captchaVerified && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSearchValid) {
      setServerError('Search is required before submitting. Please search for the current surname first.');
      return;
    }

    if (!isFormValid) {
      setServerError('Please correct the errors in the form before submitting.');
      return;
    }

    if (!captchaVerified) {
      setServerError('Please complete the anti-bot verification check.');
      return;
    }

    setLoading(true);
    setServerError(null);

    const husbandFullName = [hFirstVal.value, hMidVal.value, surnameName.trim()]
      .filter(Boolean)
      .join(' ');

    const wifeFullName = [wFirstVal.value, wMidVal.value, wLastVal.value]
      .filter(Boolean)
      .join(' ');

    const payload = {
      type: 'ONBOARD_SURNAME',
      requester_email: hEmailVal.value,
      captcha_token: 'valid',
      payload: {
        surname_name: surnameName.trim(),
        search_term: lastSearchedSurname,
        family_choice: searchResults.length > 0 ? familyChoice : 'new_lineage',
        husband: {
          first_name: hFirstVal.value,
          middle_name: hMidVal.value,
          last_name: surnameName.trim(),
          full_name: husbandFullName,
          email: hEmailVal.value,
          phone: hPhoneVal.value,
          dob: hDobVal.value, // Saved as YYYY-MM-DD
          gender: 'Male',
          relationship: 'SPOUSE'
        },
        wife: {
          first_name: wFirstVal.value,
          middle_name: wMidVal.value,
          last_name: wLastVal.value,
          full_name: wifeFullName,
          email: wEmailVal.value,
          phone: wPhoneVal.value,
          dob: wDobVal.value, // Saved as YYYY-MM-DD
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
      setServerError(err.message || 'Submission failed. Please check your inputs.');
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

        {serverError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Surname Field & Search Button */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Family Surname / Lineage Name <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Patil, Sharma, Rao, Kulkarni"
                value={surnameName}
                onBlur={() => markTouched('surname')}
                onChange={(e) => handleSurnameChange(e.target.value)}
                className={`flex-1 px-4 py-2.5 bg-slate-50 border rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                  touched.surname && !surnameVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                }`}
              />
              <button
                type="button"
                onClick={handleSearchSurname}
                disabled={surnameName.trim().length < 3 || searchLoading}
                className="px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 shrink-0"
              >
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>

            {touched.surname && !surnameVal.valid && (
              <p className="text-xs text-rose-600 font-medium">{surnameVal.error}</p>
            )}

            <p className="text-[11px] text-slate-400">
              Supports Unicode characters (e.g., Kannada, Hindi, Telugu). Min 3 characters required to search.
            </p>

            {/* Warning if search required */}
            {surnameName.trim().length >= 3 && !isSearchValid && !searchFailed && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Search required before submit. Click the Search button to verify existing families.</span>
              </p>
            )}

            {/* Friendly message on search failure */}
            {searchFailed && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs sm:text-sm font-medium flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Search is unavailable, please try again</span>
                </div>
                <button
                  type="button"
                  onClick={handleSearchSurname}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Search Results Display */}
            {searchCompleted && !searchFailed && surnameName.trim() === lastSearchedSurname && (
              <div className="pt-2">
                {searchHasPending ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">A request for this surname is awaiting approval</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {searchPendingMessage || `An onboarding request for surname "${lastSearchedSurname}" is pending review.`}
                      </p>
                    </div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Existing Family Members Found ({searchResults.length})
                      </h4>
                      <span className="text-[11px] font-medium text-slate-500">
                        Founding members first
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-800">
                        Please select an option to proceed:
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="familyChoice"
                            value="different_family"
                            checked={familyChoice === 'different_family'}
                            onChange={() => setFamilyChoice('different_family')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>This is a different family, continue onboarding</span>
                        </label>
                        <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="familyChoice"
                            value="link"
                            checked={familyChoice === 'link'}
                            onChange={() => setFamilyChoice('link')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Link to existing family (select a member below)</span>
                        </label>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                      {searchResults.map((item) => (
                        <div key={item.member_ref_id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{item.display_name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.role === 'Founding husband'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.role === 'Founding wife'
                                  ? 'bg-pink-100 text-pink-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {item.role || 'Member'}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-emerald-700 font-semibold">{item.member_ref_id}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('request', {
                              type: 'LINK_MEMBERS',
                              member_ref_id: item.member_ref_id,
                              display_name: item.display_name
                            })}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1 shrink-0"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Request link to this family</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No family found with the surname '{lastSearchedSurname}'. You can continue onboarding.</span>
                  </div>
                )}
              </div>
            )}
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

            {/* Split Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh"
                  value={husbandFirstName}
                  onBlur={() => markTouched('hFirst')}
                  onChange={(e) => setHusbandFirstName(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.hFirst && !hFirstVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.hFirst && !hFirstVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{hFirstVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kumar (optional)"
                  value={husbandMiddleName}
                  onBlur={() => markTouched('hMid')}
                  onChange={(e) => setHusbandMiddleName(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.hMid && !hMidVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.hMid && !hMidVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{hMidVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name * (Auto-filled)</label>
                <input
                  type="text"
                  readOnly
                  value={surnameName}
                  placeholder="Auto from surname"
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth (DD/MM/YYYY) *</label>
                <input
                  type="text"
                  required
                  placeholder="DD/MM/YYYY (e.g. 01011950)"
                  maxLength={10}
                  value={husbandDob}
                  onBlur={() => markTouched('hDob')}
                  onChange={(e) => setHusbandDob(formatDobMask(e.target.value))}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                    touched.hDob && !hDobVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.hDob && !hDobVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{hDobVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@example.com"
                  value={husbandEmail}
                  onBlur={() => markTouched('hEmail')}
                  onChange={(e) => setHusbandEmail(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.hEmail && !hEmailVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.hEmail && !hEmailVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{hEmailVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  maxLength={14}
                  value={husbandPhone}
                  onBlur={() => markTouched('hPhone')}
                  onChange={(e) => setHusbandPhone(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                    touched.hPhone && !hPhoneVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.hPhone && !hPhoneVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{hPhoneVal.error}</p>
                )}
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

            {/* Split Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunita"
                  value={wifeFirstName}
                  onBlur={() => markTouched('wFirst')}
                  onChange={(e) => setWifeFirstName(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.wFirst && !wFirstVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wFirst && !wFirstVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wFirstVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Devi (optional)"
                  value={wifeMiddleName}
                  onBlur={() => markTouched('wMid')}
                  onChange={(e) => setWifeMiddleName(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.wMid && !wMidVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wMid && !wMidVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wMidVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name * (Editable)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patil or maiden surname"
                  value={wifeLastName}
                  onBlur={() => markTouched('wLast')}
                  onChange={(e) => {
                    setWifeLastName(e.target.value);
                    setWifeLastNameManuallyEdited(true);
                  }}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.wLast && !wLastVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wLast && !wLastVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wLastVal.error}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth (DD/MM/YYYY) *</label>
                <input
                  type="text"
                  required
                  placeholder="DD/MM/YYYY (e.g. 01011960)"
                  maxLength={10}
                  value={wifeDob}
                  onBlur={() => markTouched('wDob')}
                  onChange={(e) => setWifeDob(formatDobMask(e.target.value))}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                    touched.wDob && !wDobVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wDob && !wDobVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wDobVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="sunita@example.com"
                  value={wifeEmail}
                  onBlur={() => markTouched('wEmail')}
                  onChange={(e) => setWifeEmail(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${
                    touched.wEmail && !wEmailVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wEmail && !wEmailVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wEmailVal.error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  maxLength={14}
                  value={wifePhone}
                  onBlur={() => markTouched('wPhone')}
                  onChange={(e) => setWifePhone(e.target.value)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono ${
                    touched.wPhone && !wPhoneVal.valid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {touched.wPhone && !wPhoneVal.valid && (
                  <p className="text-[11px] text-rose-600 mt-1">{wPhoneVal.error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bot Protection */}
          <CaptchaWidget verified={captchaVerified} onVerify={setCaptchaVerified} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
