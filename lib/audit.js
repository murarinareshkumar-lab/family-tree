import { randomUUID } from 'node:crypto';
import { TABS } from './schema.js';
import { sanitizeFormula } from './security.js';

export async function logAuditEvent(sheetsClient, {
  admin = 'system', action, entity, entity_id = '', previous_value = '', updated_value = '', ticket_id = ''
}) {
  const rowData = {
    log_id: randomUUID(),
    timestamp: new Date().toISOString(),
    admin: sanitizeFormula(admin),
    action: sanitizeFormula(action),
    entity: sanitizeFormula(entity),
    entity_id: sanitizeFormula(entity_id),
    previous_value: sanitizeFormula(typeof previous_value === 'object' ? JSON.stringify(previous_value) : String(previous_value || '')),
    updated_value: sanitizeFormula(typeof updated_value === 'object' ? JSON.stringify(updated_value) : String(updated_value || '')),
    ticket_id: sanitizeFormula(ticket_id)
  };
  try {
    await sheetsClient.appendRow(TABS.AUDIT_LOG, rowData);
    return rowData;
  } catch { return null; }
}
