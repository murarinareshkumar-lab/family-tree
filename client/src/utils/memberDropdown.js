/**
 * Utility for formatting family member names in selection dropdowns.
 * 
 * Rules per specification:
 * 1. Default: Show ONLY the member's name (no UCIC / member_ref_id, no technical tags).
 * 2. If there are duplicate or identical/similar names in that family:
 *    a. If spouse is available:
 *       - Female: "<Name> (Wife of <Spouse Name>)"
 *       - Male: "<Name> (Husband of <Spouse Name>)"
 *       - Other: "<Name> (Spouse of <Spouse Name>)"
 *    b. If spouse is NOT available:
 *       - Male: "<Name> (Son of <Parent Name>)"
 *       - Female: "<Name> (Daughter of <Parent Name>)"
 *       - Other: "<Name> (Child of <Parent Name>)"
 * 3. Never display technical UCIC / member reference IDs at UI level.
 */

export function formatMemberDropdownLabel(member, allMembers = []) {
  if (!member) return '';
  const name = (member.full_name || member.display_name || member.name || '').trim();
  if (!name) return 'Member';

  // Check how many members in this family share this exact or normalized name
  const normName = name.toLowerCase();
  const similarMembers = (Array.isArray(allMembers) ? allMembers : []).filter(m => {
    const otherName = (m.full_name || m.display_name || m.name || '').trim().toLowerCase();
    return otherName === normName;
  });

  // If the name is unique within this family, show ONLY the name
  if (similarMembers.length <= 1) {
    return name;
  }

  // Duplicate / similar name found -> disambiguate using relatives
  const gender = String(member.gender || '').toUpperCase();
  const isFemale = gender === 'FEMALE';
  const isMale = gender === 'MALE';

  // 1. Resolve Spouse first
  let spouseName = (member.spouse_name || '').trim();
  if (!spouseName && member.founding_role && Array.isArray(allMembers)) {
    const role = String(member.founding_role).toUpperCase();
    if (role === 'HUSBAND') {
      const wife = allMembers.find(x => String(x.founding_role).toUpperCase() === 'WIFE');
      if (wife) spouseName = (wife.full_name || wife.display_name || wife.name || '').trim();
    } else if (role === 'WIFE') {
      const husband = allMembers.find(x => String(x.founding_role).toUpperCase() === 'HUSBAND');
      if (husband) spouseName = (husband.full_name || husband.display_name || husband.name || '').trim();
    }
  }

  if (spouseName) {
    if (isFemale) {
      return `${name} (Wife of ${spouseName})`;
    }
    if (isMale) {
      return `${name} (Husband of ${spouseName})`;
    }
    return `${name} (Spouse of ${spouseName})`;
  }

  // 2. If spouse is not available, resolve Parent (Father or Mother)
  let parentName = (member.father_name || member.mother_name || member.parent_name || '').trim();
  if (!parentName && Array.isArray(allMembers)) {
    if (member.father_person_id) {
      const f = allMembers.find(x => (x.person_id || x.id) === member.father_person_id);
      if (f) parentName = (f.full_name || f.display_name || f.name || '').trim();
    } else if (member.mother_person_id) {
      const m = allMembers.find(x => (x.person_id || x.id) === member.mother_person_id);
      if (m) parentName = (m.full_name || m.display_name || m.name || '').trim();
    }
  }

  if (parentName) {
    if (isFemale) {
      return `${name} (Daughter of ${parentName})`;
    }
    if (isMale) {
      return `${name} (Son of ${parentName})`;
    }
    return `${name} (Child of ${parentName})`;
  }

  // 3. Fallback if neither spouse nor parent is recorded
  if (member.founding_role) {
    return `${name} (Founding ${member.founding_role})`;
  }

  return name;
}
