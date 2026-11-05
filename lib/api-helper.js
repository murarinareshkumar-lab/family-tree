import { verifyAdminToken, extractToken } from './auth.js';
import { checkRateLimit } from './security.js';

export function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function parseQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const url = req.url || '';
  const q = url.indexOf('?');
  if (q === -1) return {};
  const params = new URLSearchParams(url.slice(q + 1));
  const query = {};
  for (const [k, v] of params.entries()) query[k] = v;
  return query;
}

export function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, { error: message, details, timestamp: new Date().toISOString() });
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

export function requireAdmin(req, res) {
  const secretKey = process.env.ADMIN_SECRET_KEY;
  const query = parseQuery(req);
  const providedKey = req.headers?.['x-admin-key'] || query.key || query.admin_key;

  // 1. Check direct private admin key authorization
  if (secretKey && providedKey && String(providedKey).trim() === secretKey.trim()) {
    return { sub: 'private-admin-user', role: 'ADMIN' };
  }

  // Fallback for local testing if ADMIN_SECRET_KEY not set
  if (!secretKey && (providedKey === 'admin123' || providedKey === 'secret')) {
    return { sub: 'private-admin-user', role: 'ADMIN' };
  }

  // 2. Check JWT bearer or cookie
  const token = extractToken(req);
  if (token) {
    const decoded = verifyAdminToken(token);
    if (decoded) return decoded;
  }

  sendError(res, 401, 'Unauthorized: Access restricted to authorized private administrator URL');
  return null;
}
