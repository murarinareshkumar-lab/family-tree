import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import CaptchaWidget from '../components/CaptchaWidget';
import Modal from '../components/Modal';
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
  ShieldCheck,
  Users,
  UserPlus,
  GitMerge,
  Link2
} from 'lucide-react';

export default function OnboardSurnamePage({ onNavigate }) {
  const [surnameName, setSurnameName] = useState('');

  // Search state
  const [lastSearchedSurname, setLastSearchedSurname] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [searchFound, setSearchFound] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Array of families: [{ branch_no, surname_ref_id, husband, wife }]
  const [confirmedDifferentFamily, setConfirmedDifferentFamily] = useState(false);

  // Linking modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkFamilyA, setLinkFamilyA] = useState(null);
  const [linkMode, setLinkMode] = useState('SAME_SURNAME'); // 'SAME_SURNAME' or 'DIFF_SURNAME'
  const [targetFamilyRefId, setTargetFamilyRefId] = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState('MERGE_FAMILIES'); // MERGE_FAMILIES, PARENT_CHILD, SAME_PERSON
  const [familyAMembers, setFamilyAMembers] = useState([]);
  const [familyBMembers, setFamilyBMembers] = useState([]);
  const [personAId, setPersonAId] = useState('');
  const [personBId, setPersonBId] = useState('');
  const [relationNote, setRelationNote] = useState('');
  const [partyAEmail, setPartyAEmail] = useState('');
  const [partyBEmail, setPartyBEmail] = useState('');
  const [linkSubmitterName, setLinkSubmitterName] = useState('');
  const [linkSubmitterEmail, setLinkSubmitterEmail] = useState('');
  const [linkSubmitterPhone, setLinkSubmitterPhone] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [linkSuccessTicket, setLinkSuccessTicket] = useState(null);

  // Different surname search inside modal
  const [diffSurnameQuery, setDiffSurnameQuery] = useState('');
  const [diffSurnameResults, setDiffSurnameResults] = useState([]);
  const [diffSurnameLoading, setDiffSurnameLoading] = useState(false);
  const [diffSurnameSearched, setDiffSurnameSearched] = useState(false);

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

  // Editing the surname resets the page to step 1 (forms hidden until search completes)
  const handleSurnameChange = (val) => {
    setSurnameName(val);
    setSearchCompleted(false);
    setSearchFailed(false);
    setSearchFound(false);
    setSearchPending(false);
    setSearchResults([]);
    setConfirmedDifferentFamily(false);

    if (!wifeLastNameManuallyEdited) {
      setWifeLastName(val);
    }
  };

  // Search with fallback to ensure zero route conflicts
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
        res = await apiRequest(`/surnames?q=${encodeURIComponent(q)}`);
      }

      setLastSearchedSurname(q);
      setSearchCompleted(true);
      setSearchPending(Boolean(res.pending));
      setSearchFound(Boolean(res.found));
      setSearchResults(res.families || []);
      setConfirmedDifferentFamily(false);
    } catch (_) {
      setSearchFailed(true);
      setSearchCompleted(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // Helper functions for Linking
  const openSameSurnameLink = async (fam) => {
    setLinkFamilyA(fam);
    setLinkMode('SAME_SURNAME');
    setSelectedLinkType('MERGE_FAMILIES');
    setLinkError(null);
    setLinkSuccessTicket(null);
    setRelationNote('');
    setPartyAEmail('');
    setPartyBEmail('');

    const otherFamilies = searchResults.filter(f => f.surname_ref_id !== fam.surname_ref_id);
    const targetFam = otherFamilies[0]?.surname_ref_id || '';
    setTargetFamilyRefId(targetFam);

    try {
      const resA = await apiRequest(`/families/members?ref=${encodeURIComponent(fam.surname_ref_id)}`);
      setFamilyAMembers(resA.members || []);
      if (resA.members?.length > 0) setPersonAId(resA.members[0].person_id);
    } catch (_) {
      setFamilyAMembers([]);
    }

    if (targetFam) {
      try {
        const resB = await apiRequest(`/families/members?ref=${encodeURIComponent(targetFam)}`);
        setFamilyBMembers(resB.members || []);
        if (resB.members?.length > 0) setPersonBId(resB.members[0].person_id);
      } catch (_) {
        setFamilyBMembers([]);
      }
    } else {
      setFamilyBMembers([]);
    }

    setLinkModalOpen(true);
  };

  const handleSelectSameFamilyB = async (targetFamRef) => {
    setTargetFamilyRefId(targetFamRef);
    if (!targetFamRef) {
      setFamilyBMembers([]);
      return;
    }
    try {
      const resB = await apiRequest(`/families/members?ref=${encodeURIComponent(targetFamRef)}`);
      setFamilyBMembers(resB.members || []);
      if (resB.members?.length > 0) setPersonBId(resB.members[0].person_id);
    } catch (_) {
      setFamilyBMembers([]);
    }
  };

  const openDiffSurnameLink = async (fam) => {
    setLinkFamilyA(fam);
    setLinkMode('DIFF_SURNAME');
    setSelectedLinkType('SAME_PERSON'); // MERGE_FAMILIES not allowed across different surnames
    setTargetFamilyRefId('');
    setFamilyBMembers([]);
    setDiffSurnameQuery('');
    setDiffSurnameResults([]);
    setDiffSurnameSearched(false);
    setLinkError(null);
    setLinkSuccessTicket(null);
    setRelationNote('');
    setPartyAEmail('');
    setPartyBEmail('');

    try {
      const resA = await apiRequest(`/families/members?ref=${encodeURIComponent(fam.surname_ref_id)}`);
      setFamilyAMembers(resA.members || []);
      if (resA.members?.length > 0) setPersonAId(resA.members[0].person_id);
    } catch (_) {
      setFamilyAMembers([]);
    }

    setLinkModalOpen(true);
  };

  const handleSearchDiffSurname = async () => {
    const q = diffSurnameQuery.trim();
    if (q.length < 3) return;
    setDiffSurnameLoading(true);
    setDiffSurnameSearched(true);
    try {
      const res = await apiRequest(`/surnames/search?q=${encodeURIComponent(q)}`);
      setDiffSurnameResults(res.families || []);
    } catch (_) {
      setDiffSurnameResults([]);
    } finally {
      setDiffSurnameLoading(false);
    }
  };

  const handleSelectDiffFamilyB = async (famB) => {
    setTargetFamilyRefId(famB.surname_ref_id);
    try {
      const resB = await apiRequest(`/families/members?ref=${encodeURIComponent(famB.surname_ref_id)}`);
      setFamilyBMembers(resB.members || []);
      if (resB.members?.length > 0) setPersonBId(resB.members[0].person_id);
    } catch (_) {
      setFamilyBMembers([]);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!targetFamilyRefId) {
      setLinkError('Please select Family B to link with.');
      return;
    }
    if ((selectedLinkType === 'SAME_PERSON' || selectedLinkType === 'PARENT_CHILD') && (!personAId || !personBId)) {
      setLinkError('Please select members from both families.');
      return;
    }

    const emailAVal = validateEmail(partyAEmail, true);
    const emailBVal = validateEmail(partyBEmail, true);
    if (!emailAVal.valid) {
      setLinkError('Please enter a valid registered email for Family A: ' + emailAVal.error);
      return;
    }
    if (!emailBVal.valid) {
      setLinkError('Please enter a valid registered email for Family B: ' + emailBVal.error);
      return;
    }

    const subNameVal = validateName(linkSubmitterName, true);
    const subEmailVal = validateEmail(linkSubmitterEmail, true);
    const subPhoneVal = validatePhone(linkSubmitterPhone, true);

    if (!subNameVal.valid) {
      setLinkError('Submitter name: ' + subNameVal.error);
      return;
    }
    if (!subEmailVal.valid) {
      setLinkError('Submitter email: ' + subEmailVal.error);
      return;
    }
    if (!subPhoneVal.valid) {
      setLinkError('Submitter phone: ' + subPhoneVal.error);
      return;
    }

    setLinkSubmitting(true);
    setLinkError(null);

    const isMerge = selectedLinkType === 'MERGE_FAMILIES';
    const requestType = isMerge ? 'MERGE_FAMILIES' : 'LINK_FAMILIES';

    const payload = {
      type: requestType,
      requester_email: subEmailVal.value,
      captcha_token: 'valid',
      payload: {
        link_type: selectedLinkType,
        family_a_ref_id: linkFamilyA.surname_ref_id,
        family_b_ref_id: targetFamilyRefId,
        person_a_id: personAId || null,
        person_b_id: personBId || null,
        relation_note: relationNote.trim(),
        party_a_email: emailAVal.value,
        party_b_email: emailBVal.value,
        second_party_email: emailBVal.value,
        submitter_name: subNameVal.value,
        submitter_email: subEmailVal.value,
        submitter_phone: subPhoneVal.value
      }
    };

    try {
      const res = await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setLinkSuccessTicket(res.ticket_id);
    } catch (err) {
      setLinkError(err.message || 'Failed to submit link request');
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Form field validations
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

  // Search valid rule: must have searched current surname value
  const isSearchValid =
    searchCompleted &&
    !searchFailed &&
    surnameName.trim() === lastSearchedSurname &&
    surnameName.trim().length >= 3;

  // Flow rule: forms stay hidden until search finishes; if family found, forms show ONLY when confirmedDifferentFamily is checked
  const showFoundingForms = isSearchValid && (!searchFound || confirmedDifferentFamily);

  // Submit button rule: search completed AND (no family found OR confirmation checkbox ticked) AND form valid
  const canSubmit =
    isFormValid &&
    isSearchValid &&
    (!searchFound || confirmedDifferentFamily) &&
    captchaVerified &&
    !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSearchValid) {
      setServerError('Search is required before submitting. Please search for the current surname first.');
      return;
    }

    if (searchFound && !confirmedDifferentFamily) {
      setServerError('Please confirm that your family is different from the existing families listed above.');
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
        surname_searched: lastSearchedSurname,
        surname_ref_ids_shown: searchResults.map(f => f.surname_ref_id),
        different_family_confirmed: Boolean(confirmedDifferentFamily),
        husband: {
          first_name: hFirstVal.value,
          middle_name: hMidVal.value,
          last_name: surnameName.trim(),
          full_name: husbandFullName,
          email: hEmailVal.value,
          phone: hPhoneVal.value,
          dob: hDobVal.value, // YYYY-MM-DD
          gender: 'Male',
          founding_role: 'HUSBAND',
          relationship: 'SPOUSE'
        },
        wife: {
          first_name: wFirstVal.value,
          middle_name: wMidVal.value,
          last_name: wLastVal.value,
          full_name: wifeFullName,
          email: wEmailVal.value,
          phone: wPhoneVal.value,
          dob: wDobVal.value, // YYYY-MM-DD
          gender: 'Female',
          founding_role: 'WIFE',
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
              Search for your surname first to connect with an existing family or establish a new branch.
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
          {/* Step 1: Surname Field & Search Button */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Family Surname / Lineage Name <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Patil, Sharma, Rao, Murari"
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
              Minimum 3 characters required. Enter surname and click Search to proceed.
            </p>

            {/* Error state on search failure */}
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
              <div className="pt-2 space-y-3">
                {/* 4. If pending=true, show notice */}
                {searchPending && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs sm:text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">A request for this surname is already awaiting approval.</p>
                      <p className="text-amber-800 mt-0.5">
                        If it is your family, please wait for approval. If it is a different family you can continue below.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Surname NOT found */}
                {!searchFound ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs sm:text-sm font-medium flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>No family found with the surname '{lastSearchedSurname}'. You can add your family below.</span>
                  </div>
                ) : (
                  /* 3. Surname found: One card per existing family */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Existing Families with Surname '{lastSearchedSurname}' ({searchResults.length})
                      </h4>
                      <span className="text-[11px] font-medium text-slate-500">
                        Founding members listed below
                      </span>
                    </div>

                    <div className="space-y-3">
                      {searchResults.map((family, idx) => (
                        <div
                          key={family.surname_ref_id}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <span className="font-bold text-sm text-slate-900">
                              Family {family.branch_no || (idx + 1)}
                            </span>
                            <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold rounded-md self-start sm:self-auto">
                              {family.surname_ref_id}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-800">
                            <div>
                              <span className="font-semibold text-slate-600">Founding Husband: </span>
                              <strong>{family.husband?.name || 'N/A'}</strong>{' '}
                              <span className="font-mono text-emerald-700 font-medium">({family.husband?.member_ref_id || 'N/A'})</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Founding Wife: </span>
                              <strong>{family.wife?.name || 'N/A'}</strong>{' '}
                              <span className="font-mono text-emerald-700 font-medium">({family.wife?.member_ref_id || 'N/A'})</span>
                            </div>
                          </div>

                          {/* 3 Action Buttons per Card */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => onNavigate('add-member', { surname_ref_id: family.surname_ref_id })}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add members</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openSameSurnameLink(family)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center space-x-1.5"
                            >
                              <GitMerge className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Link a same-surname family</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDiffSurnameLink(family)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center space-x-1.5"
                            >
                              <Link2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Link a different-surname family</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Separate option: My family is different */}
                    <div className="p-4 bg-white border-2 border-dashed border-slate-300 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">
                        My family is different - add my family as a new family with the same surname
                      </span>
                      <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={confirmedDifferentFamily}
                          onChange={(e) => setConfirmedDifferentFamily(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          I confirm my family is not one of the families listed above.
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Founding Member Forms (Hidden until search finishes AND [no family found OR confirmation checkbox ticked]) */}
          {showFoundingForms && (
            <div className="space-y-6 pt-2 animate-in fade-in duration-200">
              {/* Husband Section */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Founding Member 1 (Husband)
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    FOUNDING HUSBAND
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
                    FOUNDING WIFE
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
            </div>
          )}
        </form>
      </div>

      {/* Linking Modal Dialog */}
      <Modal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title={linkMode === 'SAME_SURNAME' ? 'Link Same-Surname Family' : 'Link Different-Surname Family'}
        maxWidth="max-w-xl"
      >
        {linkSuccessTicket ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Link Request Created!</h4>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Ticket ID</span>
              <p className="text-xl font-mono font-extrabold text-emerald-700 mt-0.5 select-all">{linkSuccessTicket}</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                <Mail className="w-3.5 h-3.5" />
                <span>Dual Mail Verification Required</span>
              </div>
              <p>
                Both parties (Family A and Family B registered emails) must send an email to <strong className="font-mono">support@familytree.local</strong> with subject:
              </p>
              <p className="font-mono bg-white p-1.5 rounded border border-amber-200 select-all font-semibold text-slate-800">
                Verify Ticket: {linkSuccessTicket}
              </p>
              <p className="text-[11px] text-amber-700">The Administrator will verify both before approving.</p>
            </div>
            <button
              type="button"
              onClick={() => { setLinkModalOpen(false); setLinkSuccessTicket(null); }}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleLinkSubmit} className="space-y-4 text-xs">
            {linkError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{linkError}</span>
              </div>
            )}

            {/* Family A Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold block mb-1">Family A (Selected)</span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  Family {linkFamilyA?.branch_no || 1}
                </span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {linkFamilyA?.surname_ref_id}
                </span>
              </div>
              <p className="text-slate-600 mt-1">
                Founding: {linkFamilyA?.husband?.name || 'N/A'} & {linkFamilyA?.wife?.name || 'N/A'}
              </p>
            </div>

            {/* Family B Selection */}
            {linkMode === 'SAME_SURNAME' ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Family B to link with *
                </label>
                {searchResults.filter(f => f.surname_ref_id !== linkFamilyA?.surname_ref_id).length === 0 ? (
                  <p className="text-slate-500 italic p-2 bg-slate-50 rounded-lg">
                    No other family with the surname '{lastSearchedSurname}' found.
                  </p>
                ) : (
                  <select
                    value={targetFamilyRefId}
                    onChange={(e) => handleSelectSameFamilyB(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Family B --</option>
                    {searchResults
                      .filter(f => f.surname_ref_id !== linkFamilyA?.surname_ref_id)
                      .map((f, i) => (
                        <option key={f.surname_ref_id} value={f.surname_ref_id}>
                          Family {f.branch_no || (i + 1)} ({f.surname_ref_id}) - {f.husband?.name} & {f.wife?.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Search Family B by Surname *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter surname to search (min 3 chars)..."
                    value={diffSurnameQuery}
                    onChange={(e) => setDiffSurnameQuery(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearchDiffSurname}
                    disabled={diffSurnameQuery.trim().length < 3 || diffSurnameLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {diffSurnameLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {diffSurnameSearched && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {diffSurnameResults.length === 0 ? (
                      <p className="text-slate-500 text-[11px] text-center py-2">No matching families found.</p>
                    ) : (
                      diffSurnameResults.map((fb, idx) => (
                        <div
                          key={fb.surname_ref_id}
                          className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                            targetFamilyRefId === fb.surname_ref_id
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 hover:bg-slate-100'
                          }`}
                          onClick={() => handleSelectDiffFamilyB(fb)}
                        >
                          <div>
                            <span className="font-bold text-slate-800">Family {fb.branch_no || idx + 1} ({fb.surname_ref_id})</span>
                            <p className="text-[11px] text-slate-600">{fb.husband?.name} & {fb.wife?.name}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${targetFamilyRefId === fb.surname_ref_id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {targetFamilyRefId === fb.surname_ref_id ? 'Selected' : 'Select'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Link Type Choice */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Link Type *
              </label>
              <select
                value={selectedLinkType}
                onChange={(e) => setSelectedLinkType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                {linkMode === 'SAME_SURNAME' && (
                  <option value="MERGE_FAMILIES">MERGE_FAMILIES (Combines Family B into Family A)</option>
                )}
                <option value="SAME_PERSON">SAME_PERSON (Same person in both families)</option>
                <option value="PARENT_CHILD">PARENT_CHILD (Parent-child link across families)</option>
              </select>
              {linkMode === 'DIFF_SURNAME' && (
                <p className="text-[11px] text-slate-500 mt-1">Note: Merging families is only permitted between families sharing the exact same surname.</p>
              )}
            </div>

            {/* If PARENT_CHILD or SAME_PERSON: Person Dropdowns */}
            {(selectedLinkType === 'SAME_PERSON' || selectedLinkType === 'PARENT_CHILD') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Person in Family A *</label>
                  <select
                    value={personAId}
                    onChange={(e) => setPersonAId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="">-- Choose person --</option>
                    {familyAMembers.map(m => (
                      <option key={m.person_id} value={m.person_id}>
                        {m.name} ({m.member_ref_id}) {m.founding_role ? `[${m.founding_role}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Person in Family B *</label>
                  <select
                    value={personBId}
                    onChange={(e) => setPersonBId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="">-- Choose person --</option>
                    {familyBMembers.map(m => (
                      <option key={m.person_id} value={m.person_id}>
                        {m.name} ({m.member_ref_id}) {m.founding_role ? `[${m.founding_role}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Relation note */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Relation Note / Explanation (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Ramesh moved to another city and was recorded in both branches"
                value={relationNote}
                onChange={(e) => setRelationNote(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submitter Contact */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block">Submitter Contact Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Your Name *"
                  value={linkSubmitterName}
                  onChange={(e) => setLinkSubmitterName(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
                <input
                  type="email"
                  required
                  placeholder="Your Email *"
                  value={linkSubmitterEmail}
                  onChange={(e) => setLinkSubmitterEmail(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
                <input
                  type="tel"
                  required
                  placeholder="Your Phone (10 digits) *"
                  value={linkSubmitterPhone}
                  onChange={(e) => setLinkSubmitterPhone(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Dual Registered Emails (typed by user, never revealed on screen) */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Dual Registered Email Verification Required</span>
              </div>
              <p className="text-[11px] text-amber-800">
                To protect privacy, registered emails are never displayed. Enter the registered emails of both parties below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Family A Registered Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="familyA_member@example.com"
                    value={partyAEmail}
                    onChange={(e) => setPartyAEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Family B Registered Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="familyB_member@example.com"
                    value={partyBEmail}
                    onChange={(e) => setPartyBEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {linkSubmitting ? 'Submitting...' : 'Submit Link Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
