import express from 'express';
import { getSheetsClient } from '../../lib/sheets.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.ensureTabsAndHeaders();
    res.json({
      status: 'healthy',
      database: sheetsClient.isMock ? 'In-Memory Google Sheets Mock (Dev/Testing)' : 'Live Google Sheets API',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;

