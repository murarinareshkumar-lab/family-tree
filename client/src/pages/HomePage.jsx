import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import InteractiveTree from '../components/InteractiveTree';
import { GitBranch, Shield, Users, RefreshCw, AlertCircle, Search, UserPlus, Eye, Link } from 'lucide-react';

export default function HomePage({ onNavigate, initialParams = {} }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState('');
  const [showConnected, setShowConnected] = useState(false);
  const [treeData, setTreeData] = useState(null);
  const [loadingSurnames, setLoadingSurnames] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

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
      if (list.length > 0) {
        const targetId = initialParams?.surname_ref_id || list[0].surname_ref_id;
        setSelectedSurnameId(targetId);
        loadTree(targetId, showConnected);
      }
    } catch (err) {
      setError(err.message || 'Failed to load family surnames');
    } finally {
      setLoadingSurnames(false);
    }
  };

  const loadTree = async (surnameRefId, connected = showConnected) => {
    if (!surnameRefId) return;
    setLoadingTree(true);
    setError(null);
    try {
      const connParam = connected ? '&show_connected=true' : '';
      const res = await apiRequest(`/tree?surname_ref_id=${encodeURIComponent(surnameRefId)}${connParam}`);
      setTreeData(res);
    } catch (err) {
      setError(err.message || 'Failed to load family tree');
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSurnameChange = (id) => {
    setSelectedSurnameId(id);
    loadTree(id, showConnected);
  };

  const handleSelectFamily = (surnameRefId) => {
    setSelectedSurnameId(surnameRefId);
    loadTree(surnameRefId, showConnected);
    const treeElement = document.getElementById('tree-view-section');
    if (treeElement) {
      treeElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleConnected = () => {
    const nextState = !showConnected;
    setShowConnected(nextState);
    loadTree(selectedSurnameId, nextState);
  };

  const selectedSurnameObj = surnames.find(s => s.surname_ref_id === selectedSurnameId);

  const groupedSurnames = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const map = new Map();

    surnames.forEach((s) => {
      const sName = s.surname_name || s.surname_ref_id || 'Unknown';
      const key = sName.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { surnameName: sName, families: [] });
      }
      map.get(key).families.push(s);
    });

    const groups = Array.from(map.values());

    if (!q) return groups;

    return groups.filter(g => {
      const matchSurname = g.surnameName.toLowerCase().includes(q);
      const matchFamily = g.families.some(f =>
        (f.surname_ref_id && f.surname_ref_id.toLowerCase().includes(q)) ||
        (f.founding_husband && f.founding_husband.toLowerCase().includes(q)) ||
        (f.founding_wife && f.founding_wife.toLowerCase().includes(q))
      );
      return matchSurname || matchFamily;
    });
  }, [surnames, searchFilter]);

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
            <button
              onClick={() => onNavigate('join')}
              className="px-4 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm rounded-xl border border-blue-400/30 transition-all"
            >
              Join Family Tree
            </button>
          </div>
        </div>

        {/* Decorative background grid pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <GitBranch className="w-96 h-96 text-white" />
        </div>
      </div>

      {/* Explore Trees - Surname & Family Cards Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Explore Trees by Surname</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Browse family lineages grouped by surname across independent branches and linked families.
            </p>
          </div>

          <div className="relative min-w-[260px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search surname, founding couple, or ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {loadingSurnames ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-xs">Loading registered surnames...</p>
          </div>
        ) : groupedSurnames.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No family trees matching search</p>
            <p className="text-xs text-slate-400 mt-1">Try another surname or onboard a new family lineage</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupedSurnames.map((group) => (
              <div
                key={group.surnameName}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {group.surnameName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                          {group.surnameName}
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          {group.families.length} {group.families.length === 1 ? 'Family Branch' : 'Family Branches'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                      Verified
                    </span>
                  </div>

                  {/* List of family branches under this surname */}
                  <div className="space-y-3">
                    {group.families.map((fam, fIdx) => {
                      const isSelected = fam.surname_ref_id === selectedSurnameId;
                      return (
                        <div
                          key={fam.surname_ref_id || fIdx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'bg-white border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-slate-800">
                              Branch #{fam.branch_no || (fIdx + 1)}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                              {fam.surname_ref_id}
                            </span>
                          </div>

                          {(fam.founding_husband || fam.founding_wife) && (
                            <p className="text-xs text-slate-600 mb-2">
                              <span className="text-slate-400 font-normal">Founding:</span>{' '}
                              <span className="font-medium text-slate-700">
                                {[fam.founding_husband, fam.founding_wife].filter(Boolean).join(' & ')}
                              </span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                              <Users className="w-3 h-3 text-slate-500" />
                              {fam.member_count || 2} members
                            </span>
                            {fam.linked_families_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                                <GitBranch className="w-3 h-3 text-blue-600" />
                                {fam.linked_families_count} linked
                              </span>
                            )}
                          </div>

                          {/* Quick action buttons */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                            <button
                              onClick={() => handleSelectFamily(fam.surname_ref_id)}
                              className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg transition text-center ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700'
                              }`}
                            >
                              {isSelected ? 'Viewing' : 'View Tree'}
                            </button>
                            <button
                              onClick={() => onNavigate('add-member', { surname_ref_id: fam.surname_ref_id })}
                              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-center"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => onNavigate('join', { surname_ref_id: fam.surname_ref_id })}
                              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition text-center"
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Surnames Selector Bar & Active Tree */}
      <div id="tree-view-section" className="scroll-mt-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Currently Viewing: {selectedSurnameObj ? `${selectedSurnameObj.surname_name} (Branch #${selectedSurnameObj.branch_no || 1})` : 'Lineage Tree'}
                </h2>
                <p className="text-xs text-slate-500">Interactive lineage tree rendered from verified records</p>
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
                  {surnames.map((s, idx) => (
                    <option key={s.surname_ref_id || idx} value={s.surname_ref_id}>
                      {s.surname_name} - Branch #{s.branch_no || (idx + 1)} ({s.surname_ref_id})
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
            showConnected={showConnected}
            onToggleConnected={handleToggleConnected}
          />
        )}
      </div>
    </div>
  );
}

