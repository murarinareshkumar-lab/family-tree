import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import AdminRequestManagement from './AdminRequestManagement';
import {
  Shield, Users, GitBranch, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, LogOut, Download, GitMerge, FileText, Search, Mail, ExternalLink
} from 'lucide-react';

export default function AdminDashboardPage({ onLogout }) {
  const [activeTab, setActiveTab] = useState('requests');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tab Data States
  const [requests, setRequests] = useState([]);
  const [duplicateFlags, setDuplicateFlags] = useState([]);
  const [members, setMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Mail verification inputs per ticket: { [ticket_id]: { verified: bool, note: string } }
  const [mailVerifications, setMailVerifications] = useState({});

  // Admin confirmation for different family branch on ONBOARD_SURNAME
  const [adminConfirmedDiffFamily, setAdminConfirmedDiffFamily] = useState({});

  // Reject modal state
  const [rejectModalTicket, setRejectModalTicket] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Merge tool state
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');
  const [mergeReason, setMergeReason] = useState('');

  // Member search state
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Dashboard metrics
      const dashboardRes = await apiRequest('/admin/dashboard');
      setStats(dashboardRes.stats);

      // 2. Load Requests
      const reqRes = await apiRequest('/admin/requests');
      setRequests(reqRes.requests || []);

      // 3. Load Duplicate flags
      const dupRes = await apiRequest('/admin/duplicates');
      setDuplicateFlags(dupRes.flags || []);

      // 4. Load Members
      const memRes = await apiRequest('/admin/members');
      setMembers(memRes.members || []);

      // 5. Load Audit Log
      const auditRes = await apiRequest('/admin/audit');
      setAuditLogs(auditRes.logs || []);

      // Initialize mail verifications map
      const mVer = {};
      (reqRes.requests || []).forEach(r => {
        mVer[r.ticket_id] = {
          verified: Boolean(r.mail_verified === true || r.mail_verified === 'true'),
          note: r.mail_verified_note || '',
          second_verified: Boolean(r.second_party_mail_verified === true || r.second_party_mail_verified === 'true'),
          second_note: r.second_party_mail_note || ''
        };
      });
      setMailVerifications(mVer);
    } catch (err) {
      if (err.status === 401) {
        onLogout();
      } else {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMailVerifyChange = (ticketId, field, val) => {
    setMailVerifications(prev => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || {}),
        [field]: val
      }
    }));
  };

  const handleApprove = async (ticket) => {
    const mv = mailVerifications[ticket.ticket_id] || {};
    if (!mv.verified) {
      setError(`Cannot approve ticket ${ticket.ticket_id}: Primary party email ownership must be verified first!`);
      return;
    }

    const isDual = ticket.type === 'LINK_FAMILIES' || ticket.type === 'MERGE_FAMILIES';
    if (isDual && !mv.second_verified) {
      setError(`Cannot approve ticket ${ticket.ticket_id}: Second party email ownership must also be verified first!`);
      return;
    }

    if (ticket.type === 'ONBOARD_SURNAME' && ticket.existing_families?.length > 0 && !adminConfirmedDiffFamily[ticket.ticket_id]) {
      setError(`Cannot approve: Existing families found with this surname. Admin must check "different family branch" first.`);
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest('/admin/requests', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: ticket.ticket_id,
          action: 'approve',
          mail_verified: true,
          mail_verified_note: mv.note || 'SPF/DKIM/DMARC passed. Verified by admin.',
          second_party_mail_verified: Boolean(mv.second_verified),
          second_party_mail_note: mv.second_note || 'SPF/DKIM/DMARC passed. Verified by admin.',
          admin_confirmed_different_family: Boolean(adminConfirmedDiffFamily[ticket.ticket_id])
        })
      });
      setSuccessMsg(`Approved ticket ${ticket.ticket_id} successfully! Reference ID: ${res.surname_ref_id || res.member_ref_id || 'Done'}`);
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndoMerge = async (ticketId) => {
    if (!window.confirm(`Are you sure you want to reverse the merge performed in ticket ${ticketId}? This will restore the original person records and relationships.`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest('/admin/requests', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: ticketId,
          action: 'UNDO_MERGE'
        })
      });
      setSuccessMsg(`Merge from ticket ${ticketId} reversed successfully.`);
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Undo merge failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalTicket) return;
    setActionLoading(true);
    setError(null);

    try {
      await apiRequest('/admin/requests', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: rejectModalTicket.ticket_id,
          action: 'reject',
          admin_remarks: rejectRemarks.trim() || 'Rejected after administrative review.'
        })
      });
      setSuccessMsg(`Rejected ticket ${rejectModalTicket.ticket_id}.`);
      setRejectModalTicket(null);
      setRejectRemarks('');
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDirect = async (ticketId, reason) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiRequest('/admin/requests', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: ticketId,
          action: 'reject',
          admin_remarks: reason.trim()
        })
      });
      setSuccessMsg(`Rejected ticket ${ticketId}.`);
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteMerge = async (e) => {
    e.preventDefault();
    if (!mergePrimaryId || !mergeSecondaryId) {
      setError('Please provide both primary and duplicate member IDs.');
      return;
    }
    if (mergePrimaryId === mergeSecondaryId) {
      setError('Primary and duplicate member IDs must be different.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await apiRequest('/admin/merge', {
        method: 'POST',
        body: JSON.stringify({
          primary_person_id: mergePrimaryId,
          duplicate_person_id: mergeSecondaryId,
          reason: mergeReason
        })
      });
      setSuccessMsg(`Merged records successfully. Duplicate soft-marked as Merged and relationships re-pointed.`);
      setMergePrimaryId('');
      setMergeSecondaryId('');
      setMergeReason('');
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Merge failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      window.open(`/api/admin/export?format=${format}`, '_blank');
    } catch (err) {
      setError('Failed to initiate export.');
    }
  };

  // Filter members for directory
  const filteredMembers = members.filter(m => {
    const matchesSearch =
      (m.full_name && m.full_name.toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.member_ref_id && m.member_ref_id.toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.phone && m.phone.includes(memberSearch));
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Portal Administration</h1>
            <p className="text-xs text-slate-500">Google Sheets Storage Management & Multi-Level Verification</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 text-xs font-semibold flex items-center space-x-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200 text-xs font-bold flex items-center space-x-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center space-x-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Tickets</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{stats.pending_requests}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Duplicate Flags</span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{stats.duplicate_flags}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Surnames</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total_surnames}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Members</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total_members}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Verified %</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.verified_percent}%</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Avg Dup-Check</span>
            <p className="text-2xl font-extrabold text-slate-700 mt-1">{stats.avg_dup_check_ms}ms</p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'requests', label: 'Request Management', count: requests.filter(r => r.status === 'Pending').length },
          { id: 'duplicates', label: 'Duplicate Flags', count: duplicateFlags.length },
          { id: 'merge', label: 'Merge Tool' },
          { id: 'members', label: 'Member Directory', count: members.length },
          { id: 'audit', label: 'Audit Log' },
          { id: 'backup', label: 'Export Backup' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${activeTab === t.id
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === t.id ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-700'
                }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT 1: Consolidated Single Request Table & Filters */}
      {activeTab === 'requests' && (
        <AdminRequestManagement
          requests={requests}
          loading={loading}
          error={error}
          onRefresh={loadAllData}
          onApprove={handleApprove}
          onReject={handleRejectDirect}
          actionLoading={actionLoading}
        />
      )}

      {/* TAB CONTENT 2: Duplicate Flags */}
      {activeTab === 'duplicates' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-slate-900 text-sm">Potential Duplicate Flagged Records</h3>
          </div>
          <p className="text-xs text-slate-500">
            Records flagged during registration due to shared phone numbers (e.g. spouses) or minor name & father match.
          </p>

          {duplicateFlags.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No duplicate flags currently detected.
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateFlags.map((flag, idx) => (
                <div key={idx} className="border border-rose-200 bg-rose-50/50 p-4 rounded-xl flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-rose-900 block">{flag.reason}</span>
                    <p className="text-slate-600 mt-1">
                      Candidate: <strong>{flag.candidate_name}</strong> • Matched Existing: <strong>{flag.existing_name}</strong> ({flag.existing_id})
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('merge');
                      setMergePrimaryId(flag.existing_id);
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700"
                  >
                    Resolve in Merge Tool
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: Merge Tool */}
      {activeTab === 'merge' && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Soft Member Record Merge</h3>
              <p className="text-xs text-slate-500">
                Merges duplicate person records without deleting rows. Re-points all parent/spouse relationships to the primary person.
              </p>
            </div>
          </div>

          <form onSubmit={handleExecuteMerge} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Person ID (Surviving Record) *
              </label>
              <input
                type="text"
                required
                placeholder="UUID or Member Ref ID (e.g. PATFT-0001)"
                value={mergePrimaryId}
                onChange={(e) => setMergePrimaryId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duplicate Person ID (Will be marked as Merged) *
              </label>
              <input
                type="text"
                required
                placeholder="UUID or Member Ref ID of duplicate"
                value={mergeSecondaryId}
                onChange={(e) => setMergeSecondaryId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Administrative Reason / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Accidental duplicate submitted by both branches with confirmed email ownership."
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5"
            >
              <GitMerge className="w-4 h-4" />
              <span>Execute Soft Record Merge</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT 4: Member Directory */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member name, ID, phone, email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Merged">Merged</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-3">Member ID</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Gender / DOB</th>
                  <th className="py-2.5 px-3">Contact (Admin View)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <tr key={m.person_id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                      {m.member_ref_id || 'PENDING'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {m.full_name}
                      {m.is_deceased && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">Deceased</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {m.gender} • {m.dob || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {m.email || '—'}<br />{m.phone || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      {m.verified_by_admin ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Append-Only Audit Trail</h3>
          </div>
          <p className="text-xs text-slate-500">
            Every creation, ID assignment, duplicate check, approval, rejection, and merge is permanently recorded in Google Sheets. Rows are never updated or deleted.
          </p>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Admin</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Entity</th>
                  <th className="py-2 px-3">Entity ID</th>
                  <th className="py-2 px-3">Details / Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-bold">{log.admin}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{log.entity}</td>
                    <td className="py-2 px-3 text-slate-800 font-bold">{log.entity_id}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={log.updated_value}>
                      {log.updated_value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: Export Backup */}
      {activeTab === 'backup' && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Database Backup & Export</h3>
              <p className="text-xs text-slate-500">
                Download a complete offline snapshot of all 6 Google Sheets tabs.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <span className="font-bold uppercase tracking-wider text-slate-700 block">Automated Daily Backup Routine</span>
            <p>
              To maintain offline disaster recovery compliance, call the secure endpoint via daily cron:
            </p>
            <p className="font-mono bg-white p-2 rounded border border-slate-200 select-all">
              curl -H "Authorization: Bearer $JWT" https://&lt;domain&gt;/api/admin/export?format=json
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleExport('json')}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Snapshot</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Zip/Dump</span>
            </button>
          </div>
        </div>
      )}

      {/* Reject Remarks Modal */}
      <Modal
        isOpen={Boolean(rejectModalTicket)}
        onClose={() => setRejectModalTicket(null)}
        title={`Reject Ticket: ${rejectModalTicket?.ticket_id}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please provide administrative remarks detailing why this request is rejected. This remark will be visible to the user when tracking their ticket.
          </p>

          <textarea
            rows={3}
            placeholder="Reason for rejection (e.g. Failure to verify email ownership via support mailbox)..."
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-rose-500"
          />

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setRejectModalTicket(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectConfirm}
              disabled={actionLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

