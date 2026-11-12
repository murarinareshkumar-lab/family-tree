import React, { useState, useMemo } from 'react';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import {
  FileText, Search, Filter, RotateCcw, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, Calendar, Users, GitBranch,
  Shield, Check, X, ArrowUpDown, ChevronLeft, ChevronRight,
  ExternalLink, Mail, Phone, Info
} from 'lucide-react';

import { REQUEST_TYPE_CONFIG, resolveRequestType } from '../../../lib/request-types.js';
export { REQUEST_TYPE_CONFIG, resolveRequestType };

export default function AdminRequestManagement({
  requests = [],
  loading = false,
  error = null,
  onRefresh,
  onApprove,
  onReject,
  actionLoading = false
}) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Local verification inputs for selected request
  const [mailVerified, setMailVerified] = useState(false);
  const [mailNote, setMailNote] = useState('');
  const [secondMailVerified, setSecondMailVerified] = useState(false);
  const [secondMailNote, setSecondMailNote] = useState('');
  const [diffFamilyConfirmed, setDiffFamilyConfirmed] = useState(false);

  // Extract unique families from requests
  const uniqueFamilies = useMemo(() => {
    const fams = new Set();
    requests.forEach(r => {
      let payload = {};
      try {
        payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : (r.payload_json || {});
      } catch (_) {}
      const famName = payload.surname || payload.surname_name || payload.family_ref_id || payload.family_a_ref_id;
      if (famName) fams.add(famName);
    });
    return Array.from(fams).sort();
  }, [requests]);

  // Combined Filter logic
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      let payload = {};
      try {
        payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : (r.payload_json || {});
      } catch (_) {}

      // 1. Search Query (Ticket ID, Requester name/email, Member Ref, Surname)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const ticketMatch = String(r.ticket_id || '').toLowerCase().includes(q);
        const emailMatch = String(r.requester_email || '').toLowerCase().includes(q);
        const reqNameMatch = String(
          payload.submitter_name || payload.requester_name || payload.husband?.full_name || payload.person?.full_name || ''
        ).toLowerCase().includes(q);
        const surnameMatch = String(payload.surname || payload.surname_name || '').toLowerCase().includes(q);
        const memberRefMatch = String(payload.member_ref_id || payload.member_ref || '').toLowerCase().includes(q);

        if (!ticketMatch && !emailMatch && !reqNameMatch && !surnameMatch && !memberRefMatch) {
          return false;
        }
      }

      // 2. Request Type Filter
      if (typeFilter !== 'ALL') {
        const config = resolveRequestType(r.type, payload);
        if (config.id !== typeFilter && !config.aliases.includes(typeFilter)) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        if (String(r.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Family Filter
      if (familyFilter !== 'ALL') {
        const famName = payload.surname || payload.surname_name || payload.family_ref_id || payload.family_a_ref_id;
        if (famName !== familyFilter) {
          return false;
        }
      }

      // 5. Date Range Filter
      if (fromDate) {
        const reqDate = new Date(r.created_at || 0);
        const fDate = new Date(fromDate);
        if (reqDate < fDate) return false;
      }
      if (toDate) {
        const reqDate = new Date(r.created_at || 0);
        const tDate = new Date(toDate);
        tDate.setHours(23, 59, 59, 999);
        if (reqDate > tDate) return false;
      }

      return true;
    });
  }, [requests, searchTerm, typeFilter, statusFilter, familyFilter, fromDate, toDate]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Reset Filters handler
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setFamilyFilter('ALL');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (typeFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (familyFilter !== 'ALL') count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [searchTerm, typeFilter, statusFilter, familyFilter, fromDate, toDate]);

  // Open View Modal
  const handleOpenView = (req) => {
    setSelectedRequest(req);
    setMailVerified(Boolean(req.mail_verified === true || req.mail_verified === 'true'));
    setMailNote(req.mail_verified_note || '');
    setSecondMailVerified(Boolean(req.second_party_mail_verified === true || req.second_party_mail_verified === 'true'));
    setSecondMailNote(req.second_party_mail_note || '');
    setDiffFamilyConfirmed(false);
    setIsViewModalOpen(true);
  };

  // Trigger Approve from modal
  const handleModalApprove = async () => {
    if (!selectedRequest) return;
    await onApprove({
      ...selectedRequest,
      mail_verified: mailVerified,
      mail_verified_note: mailNote || 'SPF/DKIM/DMARC verified by admin',
      second_party_mail_verified: secondMailVerified,
      second_party_mail_note: secondMailNote || 'SPF/DKIM/DMARC verified by admin',
      admin_confirmed_different_family: diffFamilyConfirmed
    });
    setIsViewModalOpen(false);
  };

  // Open Reject Modal
  const handleOpenRejectModal = () => {
    setRejectionReason('');
    setRejectError('');
    setIsRejectModalOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectError('Rejection reason is mandatory.');
      return;
    }
    if (!selectedRequest) return;
    await onReject(selectedRequest.ticket_id, rejectionReason.trim());
    setIsRejectModalOpen(false);
    setIsViewModalOpen(false);
  };

  // Render dynamic request payload content for modal
  const renderRequestSpecificContent = (req) => {
    if (!req) return null;
    let payload = {};
    try {
      payload = typeof req.payload_json === 'string' ? JSON.parse(req.payload_json) : (req.payload_json || {});
    } catch (_) {}

    const typeConfig = resolveRequestType(req.type, payload);

    switch (typeConfig.id) {
      case 'NEW_FAMILY_REGISTRATION':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block mb-1">
                Surname Lineage
              </span>
              <p className="text-xl font-extrabold text-emerald-950 font-mono">
                {payload.surname_name || payload.surname || 'N/A'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Founding Husband */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-sm block border-b border-slate-100 pb-1">
                  Founding Husband
                </span>
                <p className="text-slate-700"><strong>Name:</strong> {payload.husband?.full_name || `${payload.husband?.first_name || ''} ${payload.husband?.last_name || ''}` || 'N/A'}</p>
                <p className="text-slate-700"><strong>DOB:</strong> {payload.husband?.dob || 'N/A'}</p>
                <p className="text-slate-700"><strong>Email:</strong> {payload.husband?.email || 'N/A'}</p>
                <p className="text-slate-700"><strong>Phone:</strong> {payload.husband?.phone || 'N/A'}</p>
              </div>

              {/* Founding Wife */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-sm block border-b border-slate-100 pb-1">
                  Founding Wife
                </span>
                <p className="text-slate-700"><strong>Name:</strong> {payload.wife?.full_name || `${payload.wife?.first_name || ''} ${payload.wife?.last_name || ''}` || 'N/A'}</p>
                <p className="text-slate-700"><strong>DOB:</strong> {payload.wife?.dob || 'N/A'}</p>
                <p className="text-slate-700"><strong>Email:</strong> {payload.wife?.email || 'N/A'}</p>
                <p className="text-slate-700"><strong>Phone:</strong> {payload.wife?.phone || 'N/A'}</p>
              </div>
            </div>

            {/* Same Surname Collision Check */}
            {req.existing_families?.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Existing Approved Families with this Surname ({req.existing_families.length})</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {req.existing_families.map(f => (
                    <div key={f.surname_ref_id} className="p-2 bg-white rounded-lg border border-amber-200/70 text-[11px]">
                      <span className="font-mono font-bold text-emerald-800">{f.surname_ref_id} (Branch #{f.branch_no || 1})</span>
                      <p className="text-slate-600">Husband: {f.husband?.name || 'N/A'} | Wife: {f.wife?.name || 'N/A'}</p>
                    </div>
                  ))}
                </div>
                {req.status === 'Pending' && (
                  <label className="flex items-start gap-2 pt-2 text-xs font-bold text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={diffFamilyConfirmed}
                      onChange={(e) => setDiffFamilyConfirmed(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500 mt-0.5"
                    />
                    <span>Admin Confirmation: This is a DIFFERENT family branch sharing the same surname.</span>
                  </label>
                )}
              </div>
            )}
          </div>
        );

      case 'ADD_MEMBER':
        return (
          <div className="space-y-4 text-xs">
            {/* Target Family & Relationship Connection */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
                Lineage Relationship Connection
              </span>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 flex-wrap">
                <span className="text-blue-900 font-extrabold">{payload.person?.full_name || 'New Person'}</span>
                <span className="text-slate-400">→</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-mono text-xs">{payload.relationship_type || payload.relationship || 'Related to'}</span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-800">{payload.related_to_name || payload.relative_person_id || 'Family Member'}</span>
              </div>
              <p className="text-slate-600 font-mono text-[11px]">Target Family: <strong>{payload.surname_ref_id || payload.family_ref_id || 'N/A'}</strong></p>
            </div>

            {/* New Member Personal Details */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 text-sm block border-b border-slate-100 pb-1">
                New Member Information
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <p><strong>Full Name:</strong> {payload.person?.full_name || `${payload.person?.first_name || ''} ${payload.person?.last_name || ''}`}</p>
                <p><strong>DOB:</strong> {payload.person?.dob || 'N/A'}</p>
                <p><strong>Gender:</strong> {payload.person?.gender || 'N/A'}</p>
                <p><strong>Email:</strong> {payload.person?.email || 'None'}</p>
                <p><strong>Phone:</strong> {payload.person?.phone || 'None'}</p>
                <p><strong>Deceased:</strong> {payload.person?.is_deceased ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* A4 Warning Banner if applicable */}
            {payload.flags && payload.flags.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Potential Match Warning Flags
                </span>
                <ul className="list-disc pl-5 text-amber-800 space-y-0.5">
                  {payload.flags.map((fl, idx) => <li key={idx}>{fl}</li>)}
                </ul>
              </div>
            )}
          </div>
        );

      case 'LINK_EXISTING_PERSON':
        return (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <span className="font-bold text-purple-900 block text-sm">Link Existing Person to Target Family</span>
              <p className="text-slate-700"><strong>Existing Member:</strong> {payload.person_name || payload.existing_member_name || 'N/A'}</p>
              <p className="text-slate-700 font-mono"><strong>Member Reference ID:</strong> <span className="bg-purple-100 px-2 py-0.5 rounded font-bold text-purple-950">{payload.member_ref_id || payload.person_id || 'N/A'}</span></p>
              <p className="text-slate-700"><strong>Target Family:</strong> {payload.target_family_ref_id || payload.family_ref_id || 'N/A'}</p>
              <p className="text-slate-700"><strong>Relationship:</strong> {payload.relationship || 'N/A'}</p>
              <p className="text-[11px] text-purple-800 font-medium">
                Note: No new person will be created. The person will retain their permanent Member Reference ID.
              </p>
            </div>
          </div>
        );

      case 'LINK_SAME_SURNAME_FAMILY':
      case 'LINK_DIFFERENT_SURNAME_FAMILY':
        return (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
              <span className="font-bold text-indigo-900 text-sm block">Family Connection Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                  <span className="font-bold text-slate-800 block mb-1">Family A</span>
                  <p className="font-mono text-emerald-700 font-bold">{req.family_a_details?.surname_name || payload.family_a_ref_id} ({payload.family_a_ref_id})</p>
                  {req.person_a_details && <p className="text-slate-600 mt-1">Person A: <strong>{req.person_a_details.name}</strong> ({req.person_a_details.member_ref_id})</p>}
                  <p className="text-[11px] text-slate-500 mt-1">Registered: {req.requester_email || payload.party_a_email || 'Entered'}</p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                  <span className="font-bold text-slate-800 block mb-1">Family B</span>
                  <p className="font-mono text-emerald-700 font-bold">{req.family_b_details?.surname_name || payload.family_b_ref_id} ({payload.family_b_ref_id})</p>
                  {req.person_b_details && <p className="text-slate-600 mt-1">Person B: <strong>{req.person_b_details.name}</strong> ({req.person_b_details.member_ref_id})</p>}
                  <p className="text-[11px] text-slate-500 mt-1">Registered: {req.second_party_email || payload.party_b_email || 'Entered'}</p>
                </div>
              </div>
              {payload.relation_note && (
                <p className="text-slate-700 italic bg-white p-2 rounded-lg border border-indigo-100">
                  Relationship Note: "{payload.relation_note}"
                </p>
              )}
            </div>
          </div>
        );

      case 'DELINK_RELATIONSHIP':
        return (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <span className="font-bold text-rose-900 text-sm block">Delink Relationship Request</span>
              <p><strong>Family A:</strong> {payload.family_a_ref_id || 'N/A'}</p>
              <p><strong>Family B:</strong> {payload.family_b_ref_id || 'N/A'}</p>
              {payload.link_id && <p className="font-mono"><strong>Link ID:</strong> {payload.link_id}</p>}
              {payload.reason && <p className="italic text-slate-700">Reason: "{payload.reason}"</p>}
              <p className="text-[11px] text-rose-700 font-semibold pt-1">
                Notice: Approving this removes the relationship cross-link. Individual person and family records are preserved.
              </p>
            </div>
          </div>
        );

      case 'EDIT_UPDATE_MEMBER':
        const changes = payload.requested_changes || payload.updated_details || {};
        const current = payload.current_details || {};
        return (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <span className="font-bold text-amber-900 text-sm block">Edit / Update Member Profile</span>
              <p className="font-mono">
                <strong>Member Reference ID:</strong> <span className="bg-white px-2 py-0.5 rounded border border-amber-300 font-bold">{payload.member_ref_id || payload.member_ref || 'N/A'}</span>
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Important Rule: The Member Reference ID is permanent and will remain unchanged after approval.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1">Current Registered Record</span>
                <p><strong>Name:</strong> {current.full_name || 'N/A'}</p>
                <p><strong>DOB:</strong> {current.dob || 'N/A'}</p>
                <p><strong>Email:</strong> {current.email || 'N/A'}</p>
                <p><strong>Phone:</strong> {current.phone || 'N/A'}</p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                <span className="font-bold text-emerald-800 block border-b border-emerald-200 pb-1">Requested Updates</span>
                <p><strong>Name:</strong> {changes.first_name ? `${changes.first_name} ${changes.last_name || ''}` : (current.full_name || 'Unchanged')}</p>
                <p><strong>DOB:</strong> {changes.dob || current.dob || 'Unchanged'}</p>
                <p><strong>Email:</strong> {changes.email || current.email || 'Unchanged'}</p>
                <p><strong>Phone:</strong> {changes.phone || current.phone || 'Unchanged'}</p>
              </div>
            </div>
          </div>
        );

      case 'JOIN_REQUEST':
        return (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl space-y-2">
              <span className="font-bold text-teal-900 text-sm block">Join Family Lineage Request</span>
              <p><strong>Target Lineage:</strong> {payload.surname_ref_id || payload.family_ref_id || 'N/A'}</p>
              <p><strong>Joiner Name:</strong> {payload.joiner_name || payload.person?.full_name || 'N/A'}</p>
              <p><strong>DOB:</strong> {payload.dob || payload.person?.dob || 'N/A'}</p>
              <p><strong>Email:</strong> {payload.email || payload.person?.email || 'N/A'}</p>
              <p><strong>Phone:</strong> {payload.phone || payload.person?.phone || 'N/A'}</p>
              <p><strong>Claimed Relationship:</strong> {payload.relationship_claimed || payload.relationship || 'N/A'}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] max-h-48 overflow-y-auto">
            <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Subtitle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Request Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review and manage all requests submitted through the Family Tree Portal.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading || actionLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* FILTER CONTROLS AREA */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {activeFilterCount} Active
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Field */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search Ticket / Requester..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Request Type Dropdown */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Request Type</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {Object.keys(REQUEST_TYPE_CONFIG).map(k => (
                <option key={k} value={REQUEST_TYPE_CONFIG[k].id}>
                  {REQUEST_TYPE_CONFIG[k].label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Family Dropdown */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Family</label>
            <select
              value={familyFilter}
              onChange={(e) => { setFamilyFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Families</option>
              {uniqueFamilies.map(fam => (
                <option key={fam} value={fam}>{fam}</option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Page Size Selector */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Rows per Page</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* SINGLE CONSOLIDATED REQUEST TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold">Loading requests...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600 space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            {requests.length === 0 ? (
              <p className="text-sm font-semibold text-slate-600">No requests found in the system.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600">No requests match the selected filters.</p>
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Ticket / Request No.</th>
                    <th className="py-3.5 px-4">Requested By</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Request Type</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRequests.map((req) => {
                    let payload = {};
                    try {
                      payload = typeof req.payload_json === 'string' ? JSON.parse(req.payload_json) : (req.payload_json || {});
                    } catch (_) {}

                    const typeConfig = resolveRequestType(req.type, payload);
                    const requesterName = payload.submitter_name || payload.requester_name || payload.husband?.full_name || payload.person?.full_name || 'Requester';

                    return (
                      <tr key={req.ticket_id} className="hover:bg-slate-50/70 transition">
                        {/* Ticket No */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                            {req.ticket_id}
                          </span>
                        </td>

                        {/* Requested By */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{requesterName}</div>
                          {req.requester_email && (
                            <div className="text-[11px] text-slate-400 font-mono">{req.requester_email}</div>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {req.created_at ? (
                            <span>
                              {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' '}
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(req.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </span>
                          ) : 'N/A'}
                        </td>

                        {/* Request Type */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${typeConfig.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                            {typeConfig.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={req.status} />
                        </td>

                        {/* View Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleOpenView(req)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl transition text-xs shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500 gap-3">
              <div>
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> of <strong>{filteredRequests.length}</strong> requests
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      currentPage === num
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REQUEST DETAILS MODAL / POPUP */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedRequest ? `Request Details - ${selectedRequest.ticket_id}` : 'Request Details'}
        maxWidth="max-w-3xl"
      >
        {selectedRequest && (() => {
          let payload = {};
          try {
            payload = typeof selectedRequest.payload_json === 'string' ? JSON.parse(selectedRequest.payload_json) : (selectedRequest.payload_json || {});
          } catch (_) {}

          const typeConfig = resolveRequestType(selectedRequest.type, payload);
          const isPending = selectedRequest.status === 'Pending';
          const isDual = selectedRequest.type === 'LINK_FAMILIES' || selectedRequest.type === 'MERGE_FAMILIES';

          return (
            <div className="space-y-6">
              {/* COMMON HEADER */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {selectedRequest.ticket_id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${typeConfig.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                      {typeConfig.label}
                    </span>
                  </div>
                  <StatusBadge status={selectedRequest.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Requested By</span>
                    <p className="font-bold text-slate-800">{payload.submitter_name || payload.requester_name || payload.husband?.full_name || selectedRequest.requester_email || 'N/A'}</p>
                    <p className="font-mono text-slate-500 text-[11px]">{selectedRequest.requester_email || 'No email'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Submitted Timestamp</span>
                    <p className="font-bold text-slate-800">
                      {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* REQUEST INFORMATION (DYNAMIC CONTENT) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-600" />
                  Request Information
                </h4>
                {renderRequestSpecificContent(selectedRequest)}
              </div>

              {/* VERIFICATION SECTION */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 text-xs">
                <span className="font-bold text-amber-900 block uppercase tracking-wider text-[11px]">
                  Identity & Email Verification
                </span>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isPending}
                      checked={mailVerified}
                      onChange={(e) => setMailVerified(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500"
                    />
                    <span>Primary Party Mail Verified (SPF/DKIM/DMARC / OTP Confirmed)</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isPending}
                    value={mailNote}
                    onChange={(e) => setMailNote(e.target.value)}
                    placeholder="Verification remarks or SPF/DKIM check notes"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
                  />
                </div>

                {isDual && (
                  <div className="pt-2 border-t border-amber-200/70 space-y-2">
                    <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isPending}
                        checked={secondMailVerified}
                        onChange={(e) => setSecondMailVerified(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500"
                      />
                      <span>Second Party Mail Verified (SPF/DKIM/DMARC / Dual Confirmation)</span>
                    </label>
                    <input
                      type="text"
                      disabled={!isPending}
                      value={secondMailNote}
                      onChange={(e) => setSecondMailNote(e.target.value)}
                      placeholder="Second party verification remarks"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* DECISION HISTORY (IF PROCESSED) */}
              {!isPending && (
                <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  selectedRequest.status === 'Approved'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {selectedRequest.status === 'Approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>Request {selectedRequest.status}</span>
                  </div>
                  {selectedRequest.decided_at && (
                    <p className="text-[11px] text-slate-600">
                      Processed on {new Date(selectedRequest.decided_at).toLocaleString()}
                    </p>
                  )}
                  {selectedRequest.admin_remarks && (
                    <p className="italic bg-white/70 p-2 rounded-lg border border-slate-200/50 mt-1">
                      Remarks: "{selectedRequest.admin_remarks}"
                    </p>
                  )}
                </div>
              )}

              {/* MODAL ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Close
                </button>

                {isPending && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenRejectModal}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={handleModalApprove}
                      disabled={actionLoading || !mailVerified || (isDual && !secondMailVerified)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {actionLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Approve Request</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* REJECT CONFIRMATION MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Request"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Please enter a mandatory reason for rejecting Ticket{' '}
            <strong className="font-mono text-slate-900">{selectedRequest?.ticket_id}</strong>.
            This reason will be recorded in the audit log and emailed to the requester.
          </p>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Rejection Reason *
            </label>
            <textarea
              rows={4}
              required
              value={rejectionReason}
              onChange={(e) => { setRejectionReason(e.target.value); setRejectError(''); }}
              placeholder="Provide a clear explanation for rejection..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-medium"
            />
            {rejectError && (
              <p className="text-rose-600 mt-1 font-semibold">{rejectError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
