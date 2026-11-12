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
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-sm text-slate-100">
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Track Request Ticket</h1>
            <p className="text-xs text-slate-400">
              Check verification status, administrator decisions, and assigned IDs
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <input
            type="text"
            required
            placeholder="Enter Ticket ID (e.g. REQ-XXXXX-XXXX)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>Check Status</span>
            )}
          </button>
        </form>

        {error && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-2xl flex items-center space-x-2 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {ticket && (
          <div className="border border-slate-800 rounded-2xl p-5 bg-slate-950/60 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Request Type</span>
                <h3 className="text-sm sm:text-base font-extrabold text-white">{ticket.type}</h3>
              </div>
              <StatusBadge status={ticket.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Ticket ID</span>
                <span className="font-mono font-bold text-emerald-400">{ticket.ticket_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Submitted On</span>
                <span className="font-medium text-slate-200">
                  {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Requester Email</span>
                <span className="font-medium text-slate-200">{ticket.requester_email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email Authentication (DKIM/SPF)</span>
                <span className={`inline-flex items-center space-x-1 font-semibold ${ticket.mail_verified ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                  <Mail className="w-3.5 h-3.5" />
                  <span>{ticket.mail_verified ? 'Verified by Admin' : 'Awaiting Email Check'}</span>
                </span>
              </div>
            </div>

            {ticket.admin_remarks && (
              <div className="border-t border-slate-800 pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Administrator Remarks
                </span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-200 font-medium">
                  {ticket.admin_remarks}
                </div>
              </div>
            )}

            {ticket.status === 'Pending' && (
              <div className="p-3 bg-amber-950/60 rounded-xl border border-amber-800 text-xs text-amber-200 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
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

