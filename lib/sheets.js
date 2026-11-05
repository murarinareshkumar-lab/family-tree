import { google } from 'googleapis';
import { TABS, HEADERS, createHeaderMap, rowToObject, objectToRow } from './schema.js';
import { sanitizeFormula } from './security.js';

class InMemorySheetsProvider {
  constructor() {
    this.sheets = {};
    for (const [tab, headers] of Object.entries(HEADERS)) {
      this.sheets[tab] = { headers: [...headers], rows: [] };
    }
    this.isMock = true;
  }
  async ensureTabsAndHeaders() { return true; }
  async getRows(tab) {
    const s = this.sheets[tab];
    return s ? s.rows.map((r, i) => ({ ...r, __rowIndex: i + 2 })) : [];
  }
  async appendRow(tab, obj) {
    const s = this.sheets[tab];
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    s.rows.push(sanitized);
    return { ...sanitized, __rowIndex: s.rows.length + 1 };
  }
  async updateRow(tab, rowIndex, obj) {
    const s = this.sheets[tab];
    const idx = rowIndex - 2;
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    s.rows[idx] = { ...s.rows[idx], ...sanitized };
    return s.rows[idx];
  }
  async getMeta(key) {
    const rows = await this.getRows(TABS.META);
    return rows.find(r => r.key === key) || null;
  }
  async setMeta(key, value, notes = '') {
    const rows = await this.getRows(TABS.META);
    const existing = rows.find(r => r.key === key);
    const now = new Date().toISOString();
    if (existing) await this.updateRow(TABS.META, existing.__rowIndex, { key, value, updated_at: now, notes });
    else await this.appendRow(TABS.META, { key, value, updated_at: now, notes });
    return true;
  }
}

class GoogleSheetsProvider {
  constructor(defaultSpreadsheetId, credentials) {
    this.spreadsheetId = defaultSpreadsheetId;
    this.auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    this.sheetsApi = google.sheets({ version: 'v4', auth: this.auth });
    this.headerMaps = new Map();
    this.isMock = false;
  }

  getSpreadsheetId(tab) {
    if (tab === TABS.SURNAMES) {
      return process.env.GOOGLE_SHEET_ID_SURNAME || this.spreadsheetId;
    }
    if (tab === TABS.PERSONS || tab === TABS.RELATIONSHIPS || tab === TABS.REQUESTS) {
      return process.env.GOOGLE_SHEET_ID_USER || this.spreadsheetId;
    }
    if (tab === TABS.AUDIT_LOG || tab === TABS.META) {
      return process.env.GOOGLE_SHEET_ID_ADMIN || this.spreadsheetId;
    }
    return this.spreadsheetId;
  }

  async ensureTabsAndHeaders() {
    const tabsToInit = Object.values(TABS);
    for (const tab of tabsToInit) {
      const sheetId = this.getSpreadsheetId(tab);
      if (!sheetId) continue;
      try {
        const meta = await this.sheetsApi.spreadsheets.get({ spreadsheetId: sheetId });
        const existing = new Set((meta.data.sheets || []).map(s => s.properties?.title));
        if (!existing.has(tab)) {
          await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
          });
        }
        const reqHeaders = HEADERS[tab] || [];
        const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!1:1` });
        if (!res.data.values || res.data.values.length === 0) {
          await this.sheetsApi.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${tab}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [reqHeaders] }
          });
          this.headerMaps.set(`${sheetId}_${tab}`, createHeaderMap(reqHeaders));
        } else {
          this.headerMaps.set(`${sheetId}_${tab}`, createHeaderMap(res.data.values[0]));
        }
      } catch (err) {
        console.warn(`Note initializing tab ${tab}:`, err.message);
      }
    }
    return true;
  }

  async getHeaderMap(tab) {
    const sheetId = this.getSpreadsheetId(tab);
    const cacheKey = `${sheetId}_${tab}`;
    if (this.headerMaps.has(cacheKey)) return this.headerMaps.get(cacheKey);
    try {
      const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!1:1` });
      const map = createHeaderMap(res.data.values?.[0] || HEADERS[tab] || []);
      this.headerMaps.set(cacheKey, map);
      return map;
    } catch {
      const fallback = createHeaderMap(HEADERS[tab] || []);
      this.headerMaps.set(cacheKey, fallback);
      return fallback;
    }
  }

  async getRows(tab) {
    const sheetId = this.getSpreadsheetId(tab);
    const map = await this.getHeaderMap(tab);
    const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!A:Z` });
    const values = res.data.values || [];
    if (values.length <= 1) return [];
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const obj = rowToObject(values[i], map);
      obj.__rowIndex = i + 1;
      rows.push(obj);
    }
    return rows;
  }

  async appendRow(tab, obj) {
    const sheetId = this.getSpreadsheetId(tab);
    const map = await this.getHeaderMap(tab);
    const headers = Array.from(map.keys());
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    const rowValues = objectToRow(sanitized, headers);
    const res = await this.sheetsApi.spreadsheets.values.append({
      spreadsheetId: sheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [rowValues] }
    });
    const match = (res.data.updates?.updatedRange || '').match(/!A(\d+):/);
    return { ...sanitized, __rowIndex: match ? parseInt(match[1], 10) : null };
  }

  async updateRow(tab, rowIndex, obj) {
    const sheetId = this.getSpreadsheetId(tab);
    const map = await this.getHeaderMap(tab);
    const headers = Array.from(map.keys());
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    const rowValues = objectToRow(sanitized, headers);
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: sheetId, range: `${tab}!A${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [rowValues] }
    });
    return { ...sanitized, __rowIndex: rowIndex };
  }

  async getMeta(key) {
    const rows = await this.getRows(TABS.META);
    return rows.find(r => r.key === key) || null;
  }

  async setMeta(key, value, notes = '') {
    const rows = await this.getRows(TABS.META);
    const existing = rows.find(r => r.key === key);
    const now = new Date().toISOString();
    if (existing) await this.updateRow(TABS.META, existing.__rowIndex, { key, value, updated_at: now, notes });
    else await this.appendRow(TABS.META, { key, value, updated_at: now, notes });
    return true;
  }
}

let instance = null;
export function getSheetsClient() {
  if (instance) return instance;
  const sheetId = process.env.GOOGLE_SHEET_ID_SURNAME || process.env.GOOGLE_SHEET_ID_USER || process.env.GOOGLE_SHEET_ID_ADMIN || process.env.GOOGLE_SHEET_ID;
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sheetId && sa) {
    try {
      const creds = sa.trim().startsWith('{') ? JSON.parse(sa) : JSON.parse(Buffer.from(sa, 'base64').toString('utf8'));
      instance = new GoogleSheetsProvider(sheetId, creds);
      return instance;
    } catch {}
  }
  instance = new InMemorySheetsProvider();
  return instance;
}
export function setSheetsClient(c) { instance = c; }
export { InMemorySheetsProvider, GoogleSheetsProvider };
