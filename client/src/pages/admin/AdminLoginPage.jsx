import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import { Shield, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function AdminLoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });
      onLoginSuccess(res.admin);
    } catch (err) {
      setError(err.message || 'Invalid credentials or account locked.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-7 shadow-sm text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center justify-center mx-auto mb-3.5">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-lg sm:text-xl font-extrabold text-center text-white">Administrator Access</h1>
        <p className="text-center text-xs text-slate-400 mt-1 mb-5">
          Single administrative account for portal oversight. 5 failed attempts will lock account.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-2xl flex items-center space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="admin@familytree.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

