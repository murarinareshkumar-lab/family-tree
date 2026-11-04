import { getSheetsClient } from '../lib/sheets.js';
import { sendJson, sendError } from '../lib/api-helper.js';

export default async function handler(req, res) {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.ensureTabsAndHeaders();
    sendJson(res, 200, {
      status: 'healthy',
      database: sheetsClient.isMock ? 'In-Memory Google Sheets Mock (Dev/Testing)' : 'Live Google Sheets API',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Health check failed: unable to connect to database', err.message);
  }
}
