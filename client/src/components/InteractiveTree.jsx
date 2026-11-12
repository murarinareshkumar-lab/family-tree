import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  List,
  Layers,
  Crosshair,
  Heart
} from 'lucide-react';
import Modal from './Modal';

/**
 * Interactive Tree Component
 * Visual connections:
 * - Spouse link indicator between partners
 * - Sibling link connection bar for brothers & sisters
 * - Clean dark mode UI
 */
export default function InteractiveTree({
  treeData,
  onRefresh,
  showConnected = false,
  onToggleConnected
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'
  const [depthLimit, setDepthLimit] = useState('2'); // '1', '2', '3', 'ALL'
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [focusedMemberId, setFocusedMemberId] = useState(null);

  const rawTree = treeData?.tree || [];
  const memberList = treeData?.members || [];

  // Toggle collapse state for a node
  const toggleCollapse = (nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand all nodes
  const expandAll = () => {
    setCollapsedNodes(new Set());
    setDepthLimit('ALL');
  };

  // Collapse all nodes that have children
  const collapseAll = () => {
    const allParentIds = new Set();
    const collectParents = (nodes) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          allParentIds.add(n.id);
          collectParents(n.children);
        }
      }
    };
    collectParents(rawTree);
    setCollapsedNodes(allParentIds);
  };

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.min(Math.max(0.5, prev + delta), 1.8));
  };

  if (!treeData || (!rawTree.length && memberList.length === 0)) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center shadow-sm">
        <Users className="w-10 h-10 text-slate-600 mx-auto mb-2.5" />
        <h3 className="text-sm font-semibold text-slate-200">No members found for this family</h3>
        <p className="text-xs text-slate-400 mt-1">
          Once the administrator approves submitted members, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Connected Families Banner */}
      {treeData.connected_families && treeData.connected_families.length > 0 && (
        <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-300">Family Connections:</span>
            {treeData.connected_families.map((cf, idx) => (
              <span
                key={idx}
                className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-slate-900 border border-emerald-500/80 text-emerald-300 rounded-lg text-[10px] font-bold"
              >
                <GitBranch className="w-3 h-3 text-emerald-400" />
                <span>{cf.badge || 'Connected Family'}</span>
              </span>
            ))}
          </div>

          {onToggleConnected && (
            <button
              type="button"
              onClick={onToggleConnected}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                showConnected
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-700/60'
              }`}
            >
              {showConnected ? 'Hide Connected Tree' : 'Show Connected Tree'}
            </button>
          )}
        </div>
      )}

      {/* Main Controls Bar */}
      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 shadow-sm flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-950 rounded-lg border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Depth and Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Depth Selector */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 text-xs font-medium text-slate-400 border border-slate-800">
            <span className="px-1.5 text-slate-500 flex items-center gap-1 text-[11px]">
              <Layers className="w-3 h-3" />
              Depth:
            </span>
            {['1', '2', '3', 'ALL'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepthLimit(d)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  depthLimit === d
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'hover:text-slate-200'
                }`}
              >
                {d === 'ALL' ? 'All' : `${d} Gen`}
              </button>
            ))}
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 text-[11px] border border-slate-800">
            <button
              type="button"
              onClick={expandAll}
              title="Expand all nodes"
              className="px-2 py-0.5 hover:bg-slate-800 rounded text-slate-300 flex items-center gap-1 transition"
            >
              <Maximize2 className="w-3 h-3" />
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all nodes"
              className="px-2 py-0.5 hover:bg-slate-800 rounded text-slate-300 flex items-center gap-1 transition ml-0.5"
            >
              <Minimize2 className="w-3 h-3" />
              Collapse
            </button>
          </div>

          {/* View Mode (Tree vs Indented List for mobile) */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 text-[11px] border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-2 py-0.5 rounded transition ${
                viewMode === 'tree' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'
              }`}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'
              }`}
            >
              <List className="w-3 h-3" />
              List
            </button>
          </div>

          {/* Zoom controls (Tree mode only) */}
          {viewMode === 'tree' && (
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 text-slate-400 border border-slate-800">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                title="Zoom Out"
                className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-semibold px-1.5 min-w-[36px] text-center text-slate-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                title="Zoom In"
                className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
                className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors ml-0.5 border-l border-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {focusedMemberId && (
            <button
              type="button"
              onClick={() => setFocusedMemberId(null)}
              className="px-2 py-0.5 text-[11px] bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-800 rounded-lg font-medium transition"
            >
              Clear Focus
            </button>
          )}

          {memberList.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded-lg border border-emerald-800/80 shrink-0">
              {memberList.length} Members
            </span>
          )}
        </div>
      </div>

      {/* Visual Canvas Area */}
      {viewMode === 'tree' ? (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 overflow-x-auto min-h-[440px] flex justify-center items-start shadow-inner">
          <div
            className="transition-transform duration-200 ease-out origin-top flex flex-col items-center space-y-12"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {rawTree.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Tree hierarchy is being processed.
              </div>
            ) : (
              rawTree.map((rootNode) => (
                <TreeNode
                  key={rootNode.id}
                  node={rootNode}
                  level={1}
                  depthLimit={depthLimit}
                  collapsedNodes={collapsedNodes}
                  onToggleCollapse={toggleCollapse}
                  onSelectMember={setSelectedMember}
                  onSetFocus={(id) => setFocusedMemberId(id)}
                  focusedMemberId={focusedMemberId}
                  searchTerm={searchTerm}
                  siblings={[]}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* Mobile Indented List View */
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 shadow-sm divide-y divide-slate-800">
          <div className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Indented Family Lineage</span>
            <span>Brothers &amp; Sisters Hierarchy</span>
          </div>
          <div className="pt-2.5 space-y-1.5">
            {rawTree.map((rootNode) => (
              <IndentedListNode
                key={rootNode.id}
                node={rootNode}
                level={0}
                depthLimit={depthLimit}
                collapsedNodes={collapsedNodes}
                onToggleCollapse={toggleCollapse}
                onSelectMember={setSelectedMember}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        </div>
      )}

      {/* Whitelisted Details Modal: Shows connections (Spouse, Brothers & Sisters) */}
      <Modal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title="Family Member Information"
        maxWidth="max-w-md"
      >
        {selectedMember && (
          <div className="space-y-3.5 text-slate-100">
            <div className="flex items-center space-x-3 p-3 bg-emerald-950/60 rounded-xl border border-emerald-800/80">
              <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white font-bold text-base flex items-center justify-center shrink-0">
                {selectedMember.display_name?.charAt(0) || 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-sm truncate">{selectedMember.display_name}</h4>
                <p className="text-[11px] text-emerald-400 mt-0.5">Verified Lineage Member</p>
              </div>
            </div>

            {/* Visual Connections Summary */}
            <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-800 pb-1">
                Immediate Family Connections
              </span>

              {selectedMember.spouses && selectedMember.spouses.length > 0 && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-pink-950 text-pink-300 border border-pink-800 rounded">
                    Spouse
                  </span>
                  <span className="font-medium text-slate-200">
                    {selectedMember.spouses.map(s => s.display_name).join(', ')}
                  </span>
                </div>
              )}

              {selectedMember.siblings && selectedMember.siblings.length > 0 ? (
                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded shrink-0">
                    Brothers &amp; Sisters
                  </span>
                  <span className="font-medium text-slate-200">
                    {selectedMember.siblings.map(s => s.display_name).join(', ')}
                  </span>
                </div>
              ) : null}

              {selectedMember.children && selectedMember.children.length > 0 && (
                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded shrink-0">
                    Children
                  </span>
                  <span className="font-medium text-slate-200">
                    {selectedMember.children.map(c => c.display_name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFocusedMemberId(selectedMember.id);
                  setSelectedMember(null);
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Crosshair className="w-3 h-3" />
                Focus on This Branch
              </button>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
              <p className="font-semibold text-slate-300">Privacy Notice</p>
              <p>This lineage tree is public. Contact details and personal records are restricted to verified members and portal administrators.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TreeNode({
  node,
  level,
  depthLimit,
  collapsedNodes,
  onToggleCollapse,
  onSelectMember,
  onSetFocus,
  focusedMemberId,
  searchTerm,
  siblings = []
}) {
  const children = node.children || [];
  const spouses = node.spouses || [];

  const maxLevel = depthLimit === 'ALL' ? Infinity : parseInt(depthLimit, 10);
  const isDepthExceeded = level >= maxLevel;
  const isCollapsed = collapsedNodes.has(node.id) || isDepthExceeded;
  const hasChildren = children.length > 0;
  const isFocused = focusedMemberId && (node.id === focusedMemberId || spouses.some(s => s.id === focusedMemberId));

  const handleSelectSelf = () => {
    onSelectMember({
      ...node,
      spouses,
      children,
      siblings: siblings.filter(s => s.id !== node.id)
    });
  };

  return (
    <div className={`flex flex-col items-center ${isFocused ? 'ring-2 ring-amber-400 rounded-2xl p-2 bg-amber-950/30' : ''}`}>
      {/* Node Card with Spouse Connection */}
      <div className="flex items-center relative z-10">
        <MemberCard
          member={node}
          onClick={handleSelectSelf}
          highlight={searchTerm && node.display_name?.toLowerCase().includes(searchTerm.toLowerCase())}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => onToggleCollapse(node.id)}
          hasSiblingLink={siblings.length > 1}
        />

        {/* Spouse Connection Line with Badge */}
        {spouses.map((spouse) => (
          <React.Fragment key={spouse.id}>
            <div className="flex items-center px-1 shrink-0">
              <div className="w-2.5 sm:w-4 h-0.5 bg-pink-500/80" />
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-pink-950 text-pink-300 border border-pink-700/80 rounded-full shadow-xs whitespace-nowrap">
                Spouse Link
              </span>
              <div className="w-2.5 sm:w-4 h-0.5 bg-pink-500/80" />
            </div>

            <MemberCard
              member={spouse}
              isSpouse
              onClick={() => onSelectMember({
                ...spouse,
                spouses: [node],
                siblings: []
              })}
              highlight={searchTerm && spouse.display_name?.toLowerCase().includes(searchTerm.toLowerCase())}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Children connector lines when expanded */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center mt-3 animate-fadeIn">
          {/* Vertical drop line from parents */}
          <div className="w-0.5 h-6 bg-indigo-500/80" />

          {/* Children container with horizontal connecting bar for Brothers & Sisters */}
          <div className="relative pt-6">
            {children.length > 1 && (
              <>
                {/* Brothers & Sisters Link Line */}
                <div
                  className="absolute top-0 h-0.5 bg-indigo-500/80"
                  style={{
                    left: `${(1 / (children.length * 2)) * 100}%`,
                    right: `${(1 / (children.length * 2)) * 100}%`
                  }}
                />

                {/* Sibling (Brothers & Sisters) Badge on connecting bar */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/80 rounded-full shadow-xs flex items-center gap-1 z-10 whitespace-nowrap">
                  <Users className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Siblings Link (Brothers &amp; Sisters)</span>
                </div>
              </>
            )}

            <div className="flex items-start justify-center space-x-6 sm:space-x-10">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  {/* Vertical drop line to child */}
                  <div className="w-0.5 h-6 bg-indigo-500/80 absolute -top-6" />
                  <TreeNode
                    node={child}
                    level={level + 1}
                    depthLimit={depthLimit}
                    collapsedNodes={collapsedNodes}
                    onToggleCollapse={onToggleCollapse}
                    onSelectMember={onSelectMember}
                    onSetFocus={onSetFocus}
                    focusedMemberId={focusedMemberId}
                    searchTerm={searchTerm}
                    siblings={children}
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

function MemberCard({ member, onClick, highlight, hasChildren, isCollapsed, onToggleCollapse, isSpouse, hasSiblingLink }) {
  const displayName = member.display_name || member.full_name || 'Member';

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={onClick}
        className={`group relative text-left bg-slate-900 border rounded-xl p-2.5 shadow-sm hover:shadow-md transition-all w-40 sm:w-44 hover:-translate-y-0.5 ${
          highlight
            ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/40'
            : isSpouse
            ? 'border-pink-800/80 hover:border-pink-500'
            : 'border-slate-800 hover:border-emerald-600'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
            isSpouse
              ? 'bg-pink-950 text-pink-300 border border-pink-800/60'
              : 'bg-slate-800 text-slate-300 group-hover:bg-emerald-950 group-hover:text-emerald-300'
          }`}>
            {displayName.charAt(0) || 'M'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-100 truncate group-hover:text-emerald-400 transition-colors" title={displayName}>
              {displayName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {isSpouse && (
                <span className="text-[9px] font-semibold text-pink-400 bg-pink-950/70 border border-pink-800/60 px-1 rounded">
                  Spouse
                </span>
              )}
              {hasSiblingLink && !isSpouse && (
                <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-950/70 border border-indigo-800/60 px-1 rounded">
                  Sibling
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {hasChildren && onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-800 hover:bg-emerald-700 text-slate-300 hover:text-white border border-slate-600 flex items-center justify-center shadow-xs z-20 transition"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

function IndentedListNode({
  node,
  level,
  depthLimit,
  collapsedNodes,
  onToggleCollapse,
  onSelectMember,
  searchTerm
}) {
  const children = node.children || [];
  const spouses = node.spouses || [];
  const maxLevel = depthLimit === 'ALL' ? Infinity : parseInt(depthLimit, 10);
  const isDepthExceeded = level >= maxLevel;
  const isCollapsed = collapsedNodes.has(node.id) || isDepthExceeded;
  const hasChildren = children.length > 0;
  const isMatch = searchTerm && node.display_name?.toLowerCase().includes(searchTerm.toLowerCase());

  return (
    <div className="space-y-1" style={{ paddingLeft: `${level * 16}px` }}>
      <div className="flex items-center gap-1.5">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400"
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        <button
          type="button"
          onClick={() => onSelectMember({ ...node, spouses, children, siblings: [] })}
          className={`px-2.5 py-1 rounded-lg border text-left text-xs font-bold transition flex items-center gap-2 ${
            isMatch
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
          }`}
        >
          <span>{node.display_name}</span>
          {spouses.length > 0 && (
            <span className="text-pink-400 font-medium text-[11px]">
              &amp; {spouses.map(s => s.display_name).join(', ')}
            </span>
          )}
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="border-l-2 border-indigo-800/80 ml-2 pl-2 space-y-1">
          {children.map(child => (
            <IndentedListNode
              key={child.id}
              node={child}
              level={level + 1}
              depthLimit={depthLimit}
              collapsedNodes={collapsedNodes}
              onToggleCollapse={onToggleCollapse}
              onSelectMember={onSelectMember}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}
