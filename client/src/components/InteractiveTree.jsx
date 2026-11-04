import React, { useState } from 'react';
import { User, Users, Heart, Search, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import Modal from './Modal';

export default function InteractiveTree({ treeData, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedMember, setSelectedMember] = useState(null);

  if (!treeData || !treeData.members || treeData.members.length === 0) {
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

  // Filter members matching search query
  const filteredMembers = treeData.members.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.member_ref_id && m.member_ref_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group members into hierarchy: Roots (no known parents in list) and Children
  const memberMap = new Map(treeData.members.map(m => [m.person_id, m]));

  const roots = treeData.members.filter(m => !m.father_person_id && !m.mother_person_id);

  const getChildrenOf = (personId) => {
    return treeData.members.filter(m => 
      m.father_person_id === personId || m.mother_person_id === personId
    );
  };

  const getSpousesOf = (member) => {
    if (!member.relationships) return [];
    return member.relationships
      .filter(r => r.type === 'SPOUSE_OF')
      .map(r => memberMap.get(r.target_person_id))
      .filter(Boolean);
  };

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.min(Math.max(0.6, prev + delta), 1.6));
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search family member or ID..."
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
          <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            {treeData.members.length} Members
          </span>
        </div>
      </div>

      {/* Visual Canvas Area */}
      <div className="bg-slate-900/5 rounded-2xl border border-slate-200 p-6 overflow-x-auto min-h-[450px] flex justify-center items-start shadow-inner">
        <div 
          className="transition-transform duration-200 ease-out origin-top flex flex-col items-center space-y-12"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {roots.length === 0 ? (
            // Fallback flat grid if all have cross links
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMembers.map(m => (
                <MemberCard
                  key={m.person_id}
                  member={m}
                  spouses={getSpousesOf(m)}
                  onClick={() => setSelectedMember(m)}
                />
              ))}
            </div>
          ) : (
            roots.map(root => (
              <TreeNode
                key={root.person_id}
                member={root}
                memberMap={memberMap}
                getChildrenOf={getChildrenOf}
                getSpousesOf={getSpousesOf}
                onSelectMember={setSelectedMember}
                searchTerm={searchTerm}
              />
            ))
          )}
        </div>
      </div>

      {/* Public Whitelisted Details Modal */}
      <Modal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title="Family Member Information"
        maxWidth="max-w-md"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                selectedMember.gender === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {selectedMember.full_name?.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">{selectedMember.full_name}</h4>
                <p className="text-xs font-mono text-emerald-700 font-semibold">{selectedMember.member_ref_id}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-emerald-200 font-medium text-slate-600">
                    {selectedMember.gender || 'Unknown'}
                  </span>
                  {selectedMember.is_deceased && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                      Deceased
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Calculated Relatives */}
            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2 text-sm">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Family Relations</h5>
              
              {selectedMember.calculated_relatives ? (
                <div className="space-y-1.5 text-xs">
                  {selectedMember.calculated_relatives.father && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Father:</span>
                      <span className="font-semibold text-slate-800">{selectedMember.calculated_relatives.father.full_name}</span>
                    </div>
                  )}
                  {selectedMember.calculated_relatives.mother && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mother:</span>
                      <span className="font-semibold text-slate-800">{selectedMember.calculated_relatives.mother.full_name}</span>
                    </div>
                  )}
                  {selectedMember.calculated_relatives.spouses?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Spouse(s):</span>
                      <span className="font-semibold text-slate-800">
                        {selectedMember.calculated_relatives.spouses.map(s => s.full_name).join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedMember.calculated_relatives.children?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Children:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedMember.calculated_relatives.children.map(c => c.full_name).join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedMember.calculated_relatives.siblings?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Siblings:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedMember.calculated_relatives.siblings.map(s => s.full_name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Direct relatives connected in tree.</p>
              )}
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Public privacy protection: Personal email, phone numbers, and dates of birth are permanently hidden from public records.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TreeNode({ member, memberMap, getChildrenOf, getSpousesOf, onSelectMember, searchTerm }) {
  const children = getChildrenOf(member.person_id);
  const spouses = getSpousesOf(member);

  return (
    <div className="flex flex-col items-center">
      {/* Node Card with Spouse */}
      <div className="flex items-center space-x-3 relative z-10">
        <MemberCard 
          member={member} 
          onClick={() => onSelectMember(member)} 
          highlight={searchTerm && member.full_name.toLowerCase().includes(searchTerm.toLowerCase())}
        />

        {spouses.map(spouse => (
          <React.Fragment key={spouse.person_id}>
            <div className="flex items-center justify-center -mx-1 text-rose-500">
              <Heart className="w-4 h-4 fill-rose-500 animate-pulse" />
            </div>
            <MemberCard 
              member={spouse} 
              onClick={() => onSelectMember(spouse)}
              highlight={searchTerm && spouse.full_name.toLowerCase().includes(searchTerm.toLowerCase())}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Children connector lines */}
      {children.length > 0 && (
        <div className="flex flex-col items-center mt-3">
          {/* Vertical line from parent */}
          <div className="w-0.5 h-6 bg-slate-300" />

          {/* Children container */}
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
              {children.map(child => (
                <div key={child.person_id} className="flex flex-col items-center relative">
                  {/* Vertical drop line to child */}
                  <div className="w-0.5 h-6 bg-slate-300 absolute -top-6" />
                  <TreeNode
                    member={child}
                    memberMap={memberMap}
                    getChildrenOf={getChildrenOf}
                    getSpousesOf={getSpousesOf}
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
  const isFemale = member.gender === 'Female';

  return (
    <button
      onClick={onClick}
      className={`group relative text-left bg-white border rounded-2xl p-3 shadow-sm hover:shadow-md transition-all w-44 hover:-translate-y-0.5 ${
        highlight
          ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
          isFemale ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-800'
        }`}>
          <User className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
            {member.full_name}
          </p>
          <p className="text-[10px] font-mono font-medium text-emerald-700 truncate">
            {member.member_ref_id || 'PENDING'}
          </p>
        </div>
      </div>
      {member.is_deceased && (
        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-slate-700 text-white text-[9px] rounded-md font-semibold">
          Deceased
        </span>
      )}
    </button>
  );
}
