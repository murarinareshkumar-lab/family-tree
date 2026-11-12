import React, { useState, useEffect, useMemo } from 'react';
import InteractiveTree from '../components/InteractiveTree';
import { apiRequest } from '../utils/api';
import {
  Users,
  Search,
  RefreshCw,
  GitBranch,
  Shield,
  Sparkles,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export default function HomePage({ onNavigate, initialParams = {} }) {
  const [surnames, setSurnames] = useState([]);
  const [selectedSurnameId, setSelectedSurnameId] = useState(initialParams.surname_ref_id || '');
  const [treeData, setTreeData] = useState(null);
  const [loadingSurnames, setLoadingSurnames] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSurnames();
  }, []);

  useEffect(() => {
    if (selectedSurnameId) {
      loadTree(selectedSurnameId, showConnected);
    }
  }, [selectedSurnameId, showConnected]);

  const loadSurnames = async () => {
    setLoadingSurnames(true);
    setError(null);
    try {
      const res = await apiRequest('/surnames');
      const list = res.surnames || [];
      setSurnames(list);
      if (list.length > 0) {
        const found = initialParams.surname_ref_id
          ? list.find(s => s.surname_ref_id === initialParams.surname_ref_id)
          : null;
        const initial = found ? found.surname_ref_id : list[0].surname_ref_id;
        setSelectedSurnameId(initial);
      }
    } catch (err) {
      setError(err.message || 'Failed to load lineages');
    } finally {
      setLoadingSurnames(false);
    }
  };

  const loadTree = async (surnameId, connected = false) => {
    if (!surnameId) return;
    setLoadingTree(true);
    setError(null);
    try {
      const query = `/tree?surname_ref_id=${encodeURIComponent(surnameId)}&show_connected=${connected ? 'true' : 'false'}`;
      const data = await apiRequest(query);
      setTreeData(data);
    } catch (err) {
      setError(err.message || 'Failed to render family tree');
      setTreeData(null);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSurnameChange = (newSurnameId) => {
    setSelectedSurnameId(newSurnameId);
  };

  const handleSelectFamily = (surnameId) => {
    setSelectedSurnameId(surnameId);
    const element = document.getElementById('tree-view-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleConnected = () => {
    setShowConnected(prev => !prev);
  };

  const selectedSurnameObj = surnames.find(s => s.surname_ref_id === selectedSurnameId);

  // Group surnames by surname_name for high-level surname cards
  const groupedSurnames = useMemo(() => {
    const map = new Map();
    const q = searchFilter.trim().toLowerCase();

    for (const s of surnames) {
      const key = (s.surname_name || 'Unknown').trim();
      if (!map.has(key)) {
        map.set(key, {
          surnameName: key,
          families: []
        });
      }
      map.get(key).families.push(s);
    }

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
    <div className="space-y-5">
      {/* Hero Header - Compact view with less scroll */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white p-4 sm:p-5 border border-emerald-900/60 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 text-[10px] font-semibold mb-2">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Google Sheets Database • Privacy-Preserving</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
            Preserve &amp; Explore Your Heritage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
            View verified lineages, submit new generations, or register your family surname with zero login friction.
          </p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('onboard')}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm"
            >
              Onboard Surname
            </button>
            <button
              onClick={() => onNavigate('add-member')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-all"
            >
              Add Member
            </button>
            <button
              onClick={() => onNavigate('join')}
              className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg border border-blue-500/40 transition-all"
            >
              Join Tree
            </button>
          </div>
        </div>

        {/* Decorative background icon */}
        <div className="absolute right-2 top-0 bottom-0 w-1/4 opacity-10 pointer-events-none flex items-center justify-end">
          <GitBranch className="w-48 h-48 text-emerald-400" />
        </div>
      </div>

      {/* Explore Trees - Surname & Family Cards Grid */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/60">
                <Users className="w-4 h-4" />
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight">Explore Trees by Surname</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Browse family lineages grouped by surname across independent branches and linked families.
            </p>
          </div>

          <div className="relative min-w-[240px] sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search surname, founding couple..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {loadingSurnames ? (
          <div className="py-8 text-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
            <p className="text-xs">Loading registered surnames...</p>
          </div>
        ) : groupedSurnames.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Users className="w-6 h-6 mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-300">No family trees matching search</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Try another surname or onboard a new family lineage</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {groupedSurnames.map((group) => (
              <div
                key={group.surnameName}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 hover:border-emerald-700/60 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 mb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                        {group.surnameName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-white leading-tight">
                          {group.surnameName}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          {group.families.length} {group.families.length === 1 ? 'Branch' : 'Branches'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80 rounded-full">
                      Verified
                    </span>
                  </div>

                  {/* List of family branches under this surname */}
                  <div className="space-y-2">
                    {group.families.map((fam, fIdx) => {
                      const isSelected = fam.surname_ref_id === selectedSurnameId;
                      return (
                        <div
                          key={fam.surname_ref_id || fIdx}
                          className={`p-2.5 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/30'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-200">
                              Branch #{fam.branch_no || (fIdx + 1)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <Users className="w-2.5 h-2.5 text-slate-500" />
                              {fam.member_count || 2} members
                            </span>
                          </div>

                          {(fam.founding_husband || fam.founding_wife) && (
                            <p className="text-[11px] text-slate-300 mb-2 truncate">
                              <span className="text-slate-500 font-normal">Founders:</span>{' '}
                              <span>{[fam.founding_husband, fam.founding_wife].filter(Boolean).join(' & ')}</span>
                            </p>
                          )}

                          {/* Quick action buttons */}
                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800">
                            <button
                              onClick={() => handleSelectFamily(fam.surname_ref_id)}
                              className={`px-2 py-1 text-[10px] font-semibold rounded transition text-center ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300'
                              }`}
                            >
                              {isSelected ? 'Viewing' : 'View'}
                            </button>
                            <button
                              onClick={() => onNavigate('add-member', { surname_ref_id: fam.surname_ref_id })}
                              className="px-2 py-1 text-[10px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-center"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => onNavigate('join', { surname_ref_id: fam.surname_ref_id })}
                              className="px-2 py-1 text-[10px] font-medium rounded bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 transition text-center"
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
      <div id="tree-view-section" className="scroll-mt-6 space-y-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 sm:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  Currently Viewing: {selectedSurnameObj ? `${selectedSurnameObj.surname_name} (Branch #${selectedSurnameObj.branch_no || 1})` : 'Lineage Tree'}
                </h2>
                <p className="text-[11px] text-slate-400">Interactive lineage tree rendered from verified records</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {loadingSurnames ? (
                <div className="flex items-center space-x-2 text-xs text-slate-400 px-2 py-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                  <span>Loading lineages...</span>
                </div>
              ) : surnames.length === 0 ? (
                <span className="text-xs text-slate-400">No approved surnames yet</span>
              ) : (
                <select
                  value={selectedSurnameId}
                  onChange={(e) => handleSurnameChange(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  {surnames.map((s, idx) => (
                    <option key={s.surname_ref_id || idx} value={s.surname_ref_id}>
                      {s.surname_name} - Branch #{s.branch_no || (idx + 1)}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => loadTree(selectedSurnameId)}
                disabled={loadingTree || !selectedSurnameId}
                title="Refresh Tree"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl flex items-center space-x-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Interactive Tree View */}
        {loadingTree ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-slate-300">Constructing Interactive Tree...</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Reading verified member graph from Google Sheets</p>
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
