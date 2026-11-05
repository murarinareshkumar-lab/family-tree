import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { sendJson, sendError, parseQuery, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const sheetsClient = getSheetsClient();
    const [surnames, persons, relationships, requests, auditLog, meta] = await Promise.all([
      sheetsClient.getRows(TABS.SURNAMES), sheetsClient.getRows(TABS.PERSONS), sheetsClient.getRows(TABS.RELATIONSHIPS),
      sheetsClient.getRows(TABS.REQUESTS), sheetsClient.getRows(TABS.AUDIT_LOG), sheetsClient.getRows(TABS.META)
    ]);
    const backup = { timestamp: new Date().toISOString(), admin: admin.sub, surnames, persons, relationships, requests, auditLog, meta };
    res.setHeader('Content-Disposition', `attachment; filename="family_tree_backup_${Date.now()}.json"`);
    sendJson(res, 200, backup);
  } catch (err) { sendError(res, 500, err.message); }
}
