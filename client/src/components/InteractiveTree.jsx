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
  Crosshair
} from 'lucide-react';
import Modal from './Modal';

/**
 * Interactive Tree Component
 * Strict public view: names and tree connecting lines only.
 * No gender icons, no reference IDs, no relationship words, no privacy footer text.
 * Enhanced navigation: expand/collapse, depth selector, mobile indented list, focus action.
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No members found for this family</h3>
        <p className="text-sm text-slate-500 mt-1">
          Once the administrator approves submitted members, they will appear here.
        </p>
      </div>
    );
  }

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

      {/* Main Controls Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Depth and Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Depth Selector */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-medium text-slate-600">
            <span className="px-2 text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Depth:
            </span>
            {['1', '2', '3', 'ALL'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepthLimit(d)}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  depthLimit === d
                    ? 'bg-white text-emerald-700 font-bold shadow-sm'
                    : 'hover:text-slate-900'
                }`}
              >
                {d === 'ALL' ? 'All' : `${d} Gen`}
              </button>
            ))}
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={expandAll}
              title="Expand all nodes"
              className="px-2 py-1 hover:bg-white rounded-lg text-slate-700 flex items-center gap-1 font-medium transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all nodes"
              className="px-2 py-1 hover:bg-white rounded-lg text-slate-700 flex items-center gap-1 font-medium transition ml-1"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Collapse
            </button>
          </div>

          {/* View Mode (Tree vs Indented List for mobile) */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-2 py-1 rounded-lg transition ${
                viewMode === 'tree' ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          {/* Zoom controls (Tree mode only) */}
          {viewMode === 'tree' && (
            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-slate-600">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                title="Zoom Out"
                className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2 min-w-[42px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                title="Zoom In"
                className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
                className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 transition-colors ml-1 border-l border-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {focusedMemberId && (
            <button
              type="button"
              onClick={() => setFocusedMemberId(null)}
              className="px-2.5 py-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-xl font-medium transition"
            >
              Clear Focus
            </button>
          )}

          {memberList.length > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shrink-0">
              {memberList.length} Members
            </span>
          )}
        </div>
      </div>

      {/* Visual Canvas Area */}
      {viewMode === 'tree' ? (
        <div className="bg-slate-900/5 rounded-2xl border border-slate-200 p-6 overflow-x-auto min-h-[480px] flex justify-center items-start shadow-inner">
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
                  level={1}
                  depthLimit={depthLimit}
                  collapsedNodes={collapsedNodes}
                  onToggleCollapse={toggleCollapse}
                  onSelectMember={setSelectedMember}
                  onSetFocus={(id) => setFocusedMemberId(id)}
                  focusedMemberId={focusedMemberId}
                  searchTerm={searchTerm}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* Mobile Indented List View */
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm divide-y divide-slate-100">
          <div className="pb-3 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Indented Family Lineage</span>
            <span>Names Only</span>
          </div>
          <div className="pt-3 space-y-2">
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFocusedMemberId(selectedMember.id);
                  setSelectedMember(null);
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Focus on This Branch
              </button>
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

function TreeNode({
  node,
  level,
  depthLimit,
  collapsedNodes,
  onToggleCollapse,
  onSelectMember,
  onSetFocus,
  focusedMemberId,
  searchTerm
}) {
  const children = node.children || [];
  const spouses = node.spouses || [];

  const maxLevel = depthLimit === 'ALL' ? Infinity : parseInt(depthLimit, 10);
  const isDepthExceeded = level >= maxLevel;
  const isCollapsed = collapsedNodes.has(node.id) || isDepthExceeded;
  const hasChildren = children.length > 0;
  const isFocused = focusedMemberId && (node.id === focusedMemberId || spouses.some(s => s.id === focusedMemberId));

  return (
    <div className={`flex flex-col items-center ${isFocused ? 'ring-2 ring-amber-400 rounded-3xl p-2 bg-amber-50/30' : ''}`}>
      {/* Node Card with Spouse and Expand/Collapse Button */}
      <div className="flex items-center space-x-3 relative z-10">
        <MemberCard
          member={node}
          onClick={() => onSelectMember(node)}
          highlight={searchTerm && node.display_name?.toLowerCase().includes(searchTerm.toLowerCase())}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => onToggleCollapse(node.id)}
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

      {/* Children connector lines when expanded */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center mt-3 animate-fadeIn">
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
                    level={level + 1}
                    depthLimit={depthLimit}
                    collapsedNodes={collapsedNodes}
                    onToggleCollapse={onToggleCollapse}
                    onSelectMember={onSelectMember}
                    onSetFocus={onSetFocus}
                    focusedMemberId={focusedMemberId}
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

function MemberCard({ member, onClick, highlight, hasChildren, isCollapsed, onToggleCollapse }) {
  const displayName = member.display_name || member.full_name || 'Member';

  return (
    <div className="relative flex items-center">
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

      {hasChildren && onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 border border-slate-300 flex items-center justify-center shadow-sm z-20 transition"
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
    <div className="space-y-1.5" style={{ paddingLeft: `${level * 20}px` }}>
      <div className="flex items-center gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <button
          type="button"
          onClick={() => onSelectMember(node)}
          className={`px-3 py-1.5 rounded-xl border text-left text-xs font-bold transition flex items-center gap-2 ${
            isMatch
              ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-400'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <span>{node.display_name}</span>
          {spouses.length > 0 && (
            <span className="text-slate-400 font-normal">
              & {spouses.map(s => s.display_name).join(', ')}
            </span>
          )}
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="border-l-2 border-slate-200 ml-2.5 pl-2 space-y-1.5">
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
