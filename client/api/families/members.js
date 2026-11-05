import { getSheetsClient } from '../../lib/sheets.js';
import { TABS } from '../../lib/schema.js';
import { sendJson, sendError, parseQuery, applyRateLimit } from '../../lib/api-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed. Use GET.');
  if (!applyRateLimit(req, res, 60)) return;

  const query = parseQuery(req);
  const ref = String(query.ref || query.surname_ref_id || '').trim().toUpperCase();

  if (!ref) {
    return sendError(res, 400, 'Query parameter "ref" (surname_ref_id) is required');
  }

  try {
    const sheetsClient = getSheetsClient();
    const persons = await sheetsClient.getRows(TABS.PERSONS);

    const familyPersons = persons.filter(
      p => p.surname_ref_id?.toUpperCase() === ref && p.status === 'Approved'
    );

    // Whitelist name, member_ref_id, person_id, founding_role only
    const members = familyPersons.map(p => ({
      name: p.full_name || '',
      member_ref_id: p.member_ref_id || '',
      person_id: p.person_id || '',
      founding_role: p.founding_role || ''
    }));

    sendJson(res, 200, { ok: true, surname_ref_id: ref, members });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch family members', err.message);
  }
}
