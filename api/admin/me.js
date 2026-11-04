import { sendJson, requireAdmin } from '../../lib/api-helper.js';
export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  sendJson(res, 200, { authenticated: true, email: admin.sub, role: admin.role });
}
