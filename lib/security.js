export function sanitizeFormula(value) {
  if (value === null || value === undefined) return '';
  let str = String(value).trimStart();
  const formulaChars = new Set(['=', '+', '-', '@', '\t', '\r']);
  while (str.length > 0 && formulaChars.has(str[0])) {
    str = str.slice(1).trimStart();
  }
  return str.trimEnd();
}

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

export function normalizeUnicode(str) {
  if (!str) return '';
  return String(str).normalize('NFKC').trim();
}

export function composeFullName(firstName = '', middleName = '', lastName = '') {
  const f = normalizeUnicode(firstName);
  const m = normalizeUnicode(middleName);
  const l = normalizeUnicode(lastName);
  return [f, m, l].filter(Boolean).join(' ');
}

export function whitelistPublicMember(person) {
  if (!person) return null;
  return {
    person_id: person.person_id || '',
    member_ref_id: person.member_ref_id || '',
    surname_ref_id: person.surname_ref_id || '',
    display_name: person.full_name || '',
    gender: person.gender || '',
    is_deceased: String(person.is_deceased).toLowerCase() === 'true',
    status: person.status || 'Approved'
  };
}

export function whitelistPublicTreeNode(node) {
  if (!node) return null;
  return {
    person_id: node.person_id || '',
    member_ref_id: node.member_ref_id || '',
    display_name: node.full_name || node.display_name || '',
    gender: node.gender || '',
    is_deceased: Boolean(node.is_deceased),
    spouses: (node.spouses || []).map(whitelistPublicMember),
    children: (node.children || []).map(whitelistPublicTreeNode)
  };
}

export function whitelistPublicSearchResult(member) {
  if (!member) return null;
  return {
    display_name: member.full_name || member.display_name || '',
    member_ref_id: member.member_ref_id || ''
  };
}

const rateLimitMap = new Map();

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
