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
  const token = extractToken(req);
  if (!token) {
    sendError(res, 401, 'Unauthorized: Admin authentication token required');
    return null;
  }
  const decoded = verifyAdminToken(token);
  if (!decoded) {
    sendError(res, 401, 'Unauthorized: Invalid or expired admin token');
    return null;
  }
  return decoded;
}

export function applyRateLimit(req, res, maxRequests = 60) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const cleanIp = String(ip).split(',')[0].trim();
  const check = checkRateLimit(cleanIp, maxRequests);
  if (!check.allowed) {
    res.setHeader('Retry-After', String(check.retryAfterSeconds));
    sendError(res, 429, `Too many requests. Please try again in ${check.retryAfterSeconds} seconds.`);
    return false;
  }
  return true;
}
