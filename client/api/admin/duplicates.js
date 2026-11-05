import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { normalizePhone } from '../../lib/duplicates.js';
import { sendJson, sendError, requireAdmin } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const sheetsClient = getSheetsClient();
    const [persons, requests] = await Promise.all([sheetsClient.getRows(TABS.PERSONS), sheetsClient.getRows(TABS.REQUESTS)]);
    const flags = [];
    const phoneMap = new Map();
    for (const p of persons) {
      const ph = normalizePhone(p.phone);
      if (!ph) continue;
      if (!phoneMap.has(ph)) phoneMap.set(ph, []);
      phoneMap.get(ph).push(p);
    }
    for (const [phone, list] of phoneMap.entries()) {
      if (list.length > 1) {
        flags.push({
          type: 'SHARED_PHONE_NUMBER', phone, message: `${list.length} members share phone ${phone}`,
          members: list.map(m => ({ person_id: m.person_id, member_ref_id: m.member_ref_id, full_name: m.full_name, surname_ref_id: m.surname_ref_id }))
        });
      }
    }
    sendJson(res, 200, { flags });
  } catch (err) { sendError(res, 500, err.message); }
}
