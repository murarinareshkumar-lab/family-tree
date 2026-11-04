import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { logAuditEvent } from '../../lib/audit.js';
import { sendJson, sendError, parseBody, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'POST required');
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const { surviving_person_id, retired_person_id, resolved_fields } = parseBody(req);
  if (!surviving_person_id || !retired_person_id) return sendError(res, 400, 'Both IDs required');

  try {
    const sheetsClient = getSheetsClient();
    const [persons, relationships] = await Promise.all([sheetsClient.getRows(TABS.PERSONS), sheetsClient.getRows(TABS.RELATIONSHIPS)]);
    const surviving = persons.find(p => p.person_id === surviving_person_id);
    const retired = persons.find(p => p.person_id === retired_person_id);
    if (!surviving || !retired) return sendError(res, 404, 'Records not found');

    await sheetsClient.updateRow(TABS.PERSONS, retired.__rowIndex, { status: 'Merged', merged_into_person_id: surviving_person_id });
    if (resolved_fields) await sheetsClient.updateRow(TABS.PERSONS, surviving.__rowIndex, resolved_fields);

    let count = 0;
    for (const r of relationships) {
      if (r.person_a_id === retired_person_id) { await sheetsClient.updateRow(TABS.RELATIONSHIPS, r.__rowIndex, { person_a_id: surviving_person_id }); count++; }
      if (r.person_b_id === retired_person_id) { await sheetsClient.updateRow(TABS.RELATIONSHIPS, r.__rowIndex, { person_b_id: surviving_person_id }); count++; }
    }
    sendJson(res, 200, { success: true, message: `Merged ${retired.member_ref_id} into ${surviving.member_ref_id}`, count });
  } catch (err) { sendError(res, 500, err.message); }
}
