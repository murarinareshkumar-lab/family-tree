// Master enum mapping for human-readable request types in Family Tree Portal
export const REQUEST_TYPE_CONFIG = {
  ALL: {
    id: 'ALL',
    label: 'All Request Types',
    color: 'slate'
  },
  NEW_FAMILY_REGISTRATION: {
    id: 'NEW_FAMILY_REGISTRATION',
    aliases: ['ONBOARD_SURNAME', 'NEW_FAMILY_REGISTRATION'],
    label: 'New Family Registration',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  ADD_MEMBER: {
    id: 'ADD_MEMBER',
    aliases: ['ADD_MEMBER'],
    label: 'Add Member',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  LINK_EXISTING_PERSON: {
    id: 'LINK_EXISTING_PERSON',
    aliases: ['LINK_EXISTING_PERSON', 'LINK_MEMBERS'],
    label: 'Link Existing Person',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200'
  },
  LINK_SAME_SURNAME_FAMILY: {
    id: 'LINK_SAME_SURNAME_FAMILY',
    aliases: ['LINK_SAME_SURNAME_FAMILY', 'LINK_FAMILIES_SAME'],
    label: 'Link Same-Surname Family',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  LINK_DIFFERENT_SURNAME_FAMILY: {
    id: 'LINK_DIFFERENT_SURNAME_FAMILY',
    aliases: ['LINK_DIFFERENT_SURNAME_FAMILY', 'LINK_FAMILIES_DIFF', 'LINK_FAMILIES'],
    label: 'Link Different-Surname Family',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200'
  },
  DELINK_RELATIONSHIP: {
    id: 'DELINK_RELATIONSHIP',
    aliases: ['DELINK_RELATIONSHIP', 'DELINK_FAMILIES', 'DELINK_MEMBERS'],
    label: 'Delink Relationship',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200'
  },
  EDIT_UPDATE_MEMBER: {
    id: 'EDIT_UPDATE_MEMBER',
    aliases: ['EDIT_UPDATE_MEMBER', 'EDIT_MEMBER', 'UPDATE_MEMBER'],
    label: 'Edit / Update Member',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  JOIN_REQUEST: {
    id: 'JOIN_REQUEST',
    aliases: ['JOIN_REQUEST', 'JOIN_TREE'],
    label: 'Join Family Tree',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200'
  }
};

export function resolveRequestType(typeStr, payload = {}) {
  const norm = String(typeStr || '').trim().toUpperCase();
  if (norm === 'LINK_FAMILIES') {
    if (payload.link_type === 'MERGE_FAMILIES' || payload.same_surname) {
      return REQUEST_TYPE_CONFIG.LINK_SAME_SURNAME_FAMILY;
    }
    return REQUEST_TYPE_CONFIG.LINK_DIFFERENT_SURNAME_FAMILY;
  }
  for (const key of Object.keys(REQUEST_TYPE_CONFIG)) {
    if (key === 'ALL') continue;
    const config = REQUEST_TYPE_CONFIG[key];
    if (config.id === norm || (config.aliases && config.aliases.includes(norm))) {
      return config;
    }
  }
  return {
    id: norm,
    label: norm.replace(/_/g, ' '),
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200'
  };
}
