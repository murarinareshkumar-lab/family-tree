import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { Search, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, Mail } from 'lucide-react';

export default function TicketStatusPage() {
  const [ticketId, setTicketId] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!ticketId.trim()) return;

    setLoading(true);
    setError(null);
    setTicket(null);

    try {
      const res = await apiRequest(`/requests/status?ticket_id=${encodeURIComponent(ticketId.trim())}`);
      setTicket(res.ticket);
    } catch (err) {
      setError(err.message || 'Ticket not found. Please check your ticket ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Track Request Ticket</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Check verification status, administrator decisions, and assigned IDs
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="text"
            required
            placeholder="Enter Ticket ID (e.g. REQ-XXXXX-XXXX)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>Check Status</span>
            )}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {ticket && (
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Request Type</span>
                <h3 className="text-base font-extrabold text-slate-900">{ticket.type}</h3>
              </div>
              <StatusBadge status={ticket.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Ticket ID</span>
                <span className="font-mono font-bold text-slate-800">{ticket.ticket_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Submitted On</span>
                <span className="font-medium text-slate-800">
                  {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Requester Email</span>
                <span className="font-medium text-slate-800">{ticket.requester_email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email Authentication (DKIM/SPF)</span>
                <span className={`inline-flex items-center space-x-1 font-semibold ${ticket.mail_verified ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                  <Mail className="w-3.5 h-3.5" />
                  <span>{ticket.mail_verified ? 'Verified by Admin' : 'Awaiting Email Check'}</span>
                </span>
              </div>
            </div>

            {ticket.admin_remarks && (
              <div className="border-t border-slate-200 pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Administrator Remarks
                </span>
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 font-medium">
                  {ticket.admin_remarks}
                </div>
              </div>
            )}

            {ticket.status === 'Pending' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This ticket is in the administrator's review queue. Remember to email <strong>support.familytree@gmail.com</strong> with the subject <strong>Verify Ticket: {ticket.ticket_id}</strong> to expedite processing.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

