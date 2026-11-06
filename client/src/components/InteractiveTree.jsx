import React, { useState } from 'react';
import { Users, Search, ZoomIn, ZoomOut, RotateCcw, GitBranch } from 'lucide-react';
import Modal from './Modal';

/**
 * Interactive Tree Component.
 * Strict public view: names and tree connecting lines only.
 * No gender icons, no reference IDs, no relationship words, no privacy footer text.
 */
export default function InteractiveTree({ treeData, onRefresh, showConnected = false, onToggleConnected }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedMember, setSelectedMember] = useState(null);

  if (!treeData || (!treeData.tree && (!treeData.members || treeData.members.length === 0))) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No members found for this family</h3>
        <p className="text-sm text-slate-500 mt-1">
          Once the administrator approves submitted members, they will appear here.
        </p>
      </div>
    );
  }

  const rawTree = treeData.tree || [];
  const memberList = treeData.members || [];

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.min(Math.max(0.6, prev + delta), 1.6));
  };

  return (
    <div className="space-y-4">
      {/* Connected Families Banner */}
      {treeData.connected_families && treeData.connected_families.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Family Connections:</span>
            {treeData.connected_families.map((cf, idx) => (
              <span
                key={idx}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border-2 border-dashed border-emerald-500 text-emerald-800 rounded-xl text-xs font-bold shadow-sm"
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
                <span>{cf.badge || 'Connected Family'}</span>
              </span>
            ))}
          </div>

          {onToggleConnected && (
            <button
              type="button"
              onClick={onToggleConnected}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                showConnected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {showConnected ? 'Hide Connected Tree' : 'Show Connected Tree'}
            </button>
          )}
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search family member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-slate-600">
            <button
              onClick={() => handleZoom(-0.1)}
              title="Zoom Out"
              className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.1)}
              title="Zoom In"
              className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
              className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors ml-1 border-l border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {memberList.length > 0 && (
            <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              {memberList.length} Members
            </span>
          )}
        </div>
      </div>

      {/* Visual Canvas Area */}
      <div className="bg-slate-900/5 rounded-2xl border border-slate-200 p-6 overflow-x-auto min-h-[450px] flex justify-center items-start shadow-inner">
        <div
          className="transition-transform duration-200 ease-out origin-top flex flex-col items-center space-y-12"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {rawTree.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Tree hierarchy is being processed.
            </div>
          ) : (
            rawTree.map((rootNode) => (
              <TreeNode
                key={rootNode.id}
                node={rootNode}
                onSelectMember={setSelectedMember}
                searchTerm={searchTerm}
              />
            ))
          )}
        </div>
      </div>

      {/* Whitelisted Details Modal: Name only */}
      <Modal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title="Family Member Information"
        maxWidth="max-w-md"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-lg flex items-center justify-center shrink-0">
                {selectedMember.display_name?.charAt(0) || 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-base truncate">{selectedMember.display_name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">Verified Lineage Member</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Public Record Notice</p>
              <p>This lineage tree is public. To protect family privacy, contact details and personal records are restricted to portal administrators.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TreeNode({ node, onSelectMember, searchTerm }) {
  const children = node.children || [];
  const spouses = node.spouses || [];

  return (
    <div className="flex flex-col items-center">
      {/* Node Card with Spouse */}
      <div className="flex items-center space-x-3 relative z-10">
        <MemberCard
          member={node}
          onClick={() => onSelectMember(node)}
          highlight={searchTerm && node.display_name?.toLowerCase().includes(searchTerm.toLowerCase())}
        />

        {spouses.map((spouse) => (
          <React.Fragment key={spouse.id}>
            <div className="w-4 h-0.5 bg-slate-400" />
            <MemberCard
              member={spouse}
              onClick={() => onSelectMember(spouse)}
              highlight={searchTerm && spouse.display_name?.toLowerCase().includes(searchTerm.toLowerCase())}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Children connector lines */}
      {children.length > 0 && (
        <div className="flex flex-col items-center mt-3">
          {/* Vertical drop line from parents */}
          <div className="w-0.5 h-6 bg-slate-300" />

          {/* Children container with horizontal connecting bar */}
          <div className="relative pt-6">
            {children.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-slate-300"
                style={{
                  left: `${(1 / (children.length * 2)) * 100}%`,
                  right: `${(1 / (children.length * 2)) * 100}%`
                }}
              />
            )}

            <div className="flex items-start justify-center space-x-8 sm:space-x-12">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  {/* Vertical drop line to child */}
                  <div className="w-0.5 h-6 bg-slate-300 absolute -top-6" />
                  <TreeNode
                    node={child}
                    onSelectMember={onSelectMember}
                    searchTerm={searchTerm}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberCard({ member, onClick, highlight }) {
  const displayName = member.display_name || member.full_name || 'Member';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left bg-white border rounded-2xl p-3 shadow-sm hover:shadow-md transition-all w-44 hover:-translate-y-0.5 ${
        highlight
          ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
          {displayName.charAt(0) || 'M'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors" title={displayName}>
            {displayName}
          </p>
        </div>
      </div>
    </button>
  );
}
