import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const loginAttempts = new Map();

export async function authenticateAdmin({ email, password, ip = 'unknown' }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@familytree.org';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_family_tree_2026';

  const trackKey = `${ip}_${email}`;
  const now = Date.now();
  const state = loginAttempts.get(trackKey) || { count: 0, lockedUntil: 0 };

  if (state.lockedUntil && now < state.lockedUntil) {
    const rem = Math.ceil((state.lockedUntil - now) / 60000);
    return { success: false, error: `Account locked. Try again in ${rem} minute(s).`, locked: true };
  }

  let match = false;
  if (String(email || '').trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
    if (adminPasswordHash) match = await bcrypt.compare(password || '', adminPasswordHash);
    else if (password === 'admin123') match = true;
  }

  if (!match) {
    state.count = (state.count || 0) + 1;
    if (state.count >= 5) {
      state.lockedUntil = now + 15 * 60 * 1000;
      loginAttempts.set(trackKey, state);
      return { success: false, error: 'Account locked after 5 failed attempts. Locked for 15 minutes.', locked: true };
    }
    loginAttempts.set(trackKey, state);
    return { success: false, error: `Invalid credentials. ${5 - state.count} attempt(s) remaining.` };
  }

  loginAttempts.delete(trackKey);
  const token = jwt.sign({ sub: adminEmail, role: 'ADMIN' }, jwtSecret, { expiresIn: '24h' });
  return { success: true, token, admin: { email: adminEmail } };
}

export function verifyAdminToken(token) {
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_family_tree_2026';
  try { return jwt.verify(token, jwtSecret); } catch { return null; }
}

export function extractToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  const cookie = req.headers?.cookie || '';
  const m = cookie.match(/family_tree_admin_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
