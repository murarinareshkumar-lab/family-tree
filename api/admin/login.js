import { authenticateAdmin } from '../../lib/auth.js';
import { sendJson, sendError, parseBody, setCookie } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  const { email, password } = parseBody(req);
  if (!email || !password) return sendError(res, 400, 'Email and password are required');

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const cleanIp = String(ip).split(',')[0].trim();
  const auth = await authenticateAdmin({ email, password, ip: cleanIp });

  if (!auth.success) return sendError(res, auth.locked ? 429 : 401, auth.error);

  setCookie(res, 'family_tree_admin_token', auth.token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/', maxAge: 86400
  });

  sendJson(res, 200, { success: true, token: auth.token, admin: auth.admin });
}
