import crypto from 'node:crypto';

/**
 * Strips dangerous leading characters to prevent Google Sheets & CSV formula injection.
 * Plain sentences only.
 */
export function sanitizeFormula(value) {
  if (value === null || value === undefined) return '';
  let str = String(value).trimStart();
  const formulaChars = new Set(['=', '+', '-', '@', '\t', '\r']);
  while (str.length > 0 && formulaChars.has(str[0])) {
    str = str.slice(1).trimStart();
  }
  return str.trimEnd();
}

/**
 * Deep sanitizes all string properties of an object or array.
 */
export function sanitizeObject(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeFormula(data);
  if (Array.isArray(data)) return data.map(sanitizeObject);
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(data)) {
      sanitized[key] = sanitizeObject(val);
    }
    return sanitized;
  }
  return data;
}

/**
 * Normalizes unicode strings (NFKC) for global and regional scripts.
 */
export function normalizeUnicode(str) {
  if (!str) return '';
  return String(str).normalize('NFKC').trim();
}

/**
 * Composes a full name from first, middle and last name parts.
 */
export function composeFullName(firstName = '', middleName = '', lastName = '') {
  const f = normalizeUnicode(firstName);
  const m = normalizeUnicode(middleName);
  const l = normalizeUnicode(lastName);
  return [f, m, l].filter(Boolean).join(' ');
}

/**
 * Generates an ephemeral throwaway node ID for public tree views.
 * The client never receives or needs internal person_id or member_ref_id.
 */
export function generateThrowawayId() {
  return 'node_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Formats a display name, including maiden name when present.
 */
export function composeDisplayName(person) {
  if (!person) return '';
  const former = person.former_name ? String(person.former_name).trim() : '';
  const baseName = person.full_name || person.display_name || person.name || '';
  if (former && !baseName.includes('(née')) {
    return `${baseName} (née ${former})`;
  }
  return baseName;
}

/**
 * Whitelist for public member data.
 * Public view sees display name only.
 * No gender, no member_ref_id, no surname_ref_id, no DOB, phone, email, photo,
 * occupation, location, status, relationship words or gender icons.
 */
export function whitelistPublicMember(person, throwawayId = null) {
  if (!person) return null;
  const displayName = composeDisplayName(person);
  return {
    id: throwawayId || generateThrowawayId(),
    display_name: displayName,
    full_name: displayName
  };
}

/**
 * Whitelist for public tree nodes.
 * Contains only ephemeral id, display_name, spouses, and children.
 */
export function whitelistPublicTreeNode(node, idMap = new Map()) {
  if (!node) return null;
  const rawId = node.person_id || node.id || node.member_ref_id || node.full_name;
  let throwawayId = idMap.get(rawId);
  if (!throwawayId) {
    throwawayId = generateThrowawayId();
    if (rawId) idMap.set(rawId, throwawayId);
  }

  const displayName = composeDisplayName(node);

  const spouses = (node.spouses || []).map(s => {
    const sRawId = s.person_id || s.id || s.member_ref_id || s.full_name;
    let sThrowawayId = idMap.get(sRawId);
    if (!sThrowawayId) {
      sThrowawayId = generateThrowawayId();
      if (sRawId) idMap.set(sRawId, sThrowawayId);
    }
    return {
      id: sThrowawayId,
      display_name: composeDisplayName(s)
    };
  });

  const children = (node.children || [])
    .map(c => whitelistPublicTreeNode(c, idMap))
    .filter(Boolean);

  return {
    id: throwawayId,
    display_name: displayName,
    spouses,
    children
  };
}

/**
 * Whitelist for public search results on founding members.
 * Returns only name. No member_ref_id or other fields.
 */
export function whitelistPublicSearchResult(member) {
  if (!member) return null;
  return {
    name: composeDisplayName(member)
  };
}

const rateLimitMap = new Map();

/**
 * Sliding window rate limiter helper.
 */
export function checkRateLimit(ip = 'anonymous', maxRequests = 60, windowMs = 60000) {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > clientData.resetAt) {
    clientData.count = 1;
    clientData.resetAt = now + windowMs;
    rateLimitMap.set(ip, clientData);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  clientData.count += 1;
  rateLimitMap.set(ip, clientData);

  if (clientData.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((clientData.resetAt - now) / 1000)
    };
  }

  return { allowed: true, remaining: maxRequests - clientData.count };
}
