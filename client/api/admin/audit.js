import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { sendJson, sendError, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const sheetsClient = getSheetsClient();
    const rows = await sheetsClient.getRows(TABS.AUDIT_LOG);
    sendJson(res, 200, { logs: rows.reverse() });
  } catch (err) { sendError(res, 500, err.message); }
}
