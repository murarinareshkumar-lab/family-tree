import { sendJson, clearCookie } from '../../lib/api-helper.js';
export default async function handler(req, res) {
  clearCookie(res, 'family_tree_admin_token');
  sendJson(res, 200, { success: true });
}
