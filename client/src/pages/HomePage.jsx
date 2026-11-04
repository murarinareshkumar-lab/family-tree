import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import InteractiveTree from '../components/InteractiveTree';
import { GitBranch, Shield, Users, RefreshCw, AlertCircle } from 'lucide-react';

export default function HomePage({ onNavigate }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [loadingSurnames, setLoadingSurnames] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);

  // Load approved surnames on mount
  useEffect(() => {
    loadSurnames();
  }, []);

  const loadSurnames = async () => {
    setLoadingSurnames(true);
    setError(null);
    try {
      const res = await apiRequest('/surnames');
      const list = res.surnames || [];
      setSurnames(list);
      if (list.length > 0 && !selectedSurnameId) {
        setSelectedSurnameId(list[0].surname_ref_id);
        loadTree(list[0].surname_ref_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load family surnames');
    } finally {
      setLoadingSurnames(false);
    }
  };

  const loadTree = async (surnameRefId) => {
    if (!surnameRefId) return;
    setLoadingTree(true);
    setError(null);
    try {
      const res = await apiRequest(`/tree?surname_ref_id=${encodeURIComponent(surnameRefId)}`);
      setTreeData(res);
    } catch (err) {
      setError(err.message || 'Failed to load family tree');
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSurnameChange = (id) => {
    setSelectedSurnameId(id);
    loadTree(id);
  };

  const selectedSurnameObj = surnames.find(s => s.surname_ref_id === selectedSurnameId);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 text-white p-8 sm:p-10 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 border border-emerald-500/30 text-xs font-semibold mb-4">
            <Shield className="w-3.5 h-3.5 text-emerald-300" />
            <span>Google Sheets Database • Privacy-Preserving Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Preserve & Explore Your Heritage
          </h1>
          <p className="mt-3 text-sm sm:text-base text-emerald-100/90 leading-relaxed">
            Welcome to the public Family Tree portal. View verified lineages, submit new generations, or register your family surname with zero login friction.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('onboard')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20"
            >
              Onboard New Surname
            </button>
            <button
              onClick={() => onNavigate('add-member')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/20 transition-all"
            >
              Add Member to Family
            </button>
          </div>
        </div>

        {/* Decorative background grid pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <GitBranch className="w-96 h-96 text-white" />
        </div>
      </div>

      {/* Surnames Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Select Family Lineage</h2>
              <p className="text-xs text-slate-500">Choose an approved surname to render its genealogy tree</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {loadingSurnames ? (
              <div className="flex items-center space-x-2 text-xs text-slate-400 px-3 py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Loading lineages...</span>
              </div>
            ) : surnames.length === 0 ? (
              <span className="text-xs text-slate-400">No approved surnames yet</span>
            ) : (
              <select
                value={selectedSurnameId}
                onChange={(e) => handleSurnameChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {surnames.map((s) => (
                  <option key={s.surname_ref_id} value={s.surname_ref_id}>
                    {s.surname_name} ({s.surname_ref_id})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => loadTree(selectedSurnameId)}
              disabled={loadingTree || !selectedSurnameId}
              title="Refresh Tree"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTree ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interactive Tree View */}
      {loadingTree ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-700">Constructing Interactive Tree...</h4>
          <p className="text-xs text-slate-400 mt-1">Reading verified member graph from Google Sheets</p>
        </div>
      ) : (
        <InteractiveTree 
          treeData={treeData} 
          onRefresh={() => loadTree(selectedSurnameId)} 
        />
      )}
    </div>
  );
}
