import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { sendJson, sendError, parseQuery, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const sheetsClient = getSheetsClient();
    const [persons, surnames, relationships] = await Promise.all([
      sheetsClient.getRows(TABS.PERSONS), sheetsClient.getRows(TABS.SURNAMES), sheetsClient.getRows(TABS.RELATIONSHIPS)
    ]);
    const q = (parseQuery(req).search || '').toLowerCase();
    const filtered = q ? persons.filter(p => p.full_name?.toLowerCase().includes(q) || p.member_ref_id?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)) : persons;
    sendJson(res, 200, { members: filtered, surnames, relationshipsCount: relationships.length });
  } catch (err) { sendError(res, 500, err.message); }
}
