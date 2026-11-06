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
    if (!s) {
      this.sheets[tab] = { headers: HEADERS[tab] || Object.keys(obj), rows: [] };
    }
    const targetSheet = this.sheets[tab];
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    targetSheet.rows.push(sanitized);
    return { ...sanitized, __rowIndex: targetSheet.rows.length + 1 };
  }
  async updateRow(tab, rowIndex, obj) {
    const s = this.sheets[tab];
    if (!s) return null;
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
    this.tabNameResolutions = new Map();
    this.isMock = false;
  }

  getSpreadsheetId(tab) {
    if (tab === TABS.SURNAMES) {
      return process.env.GOOGLE_SHEET_ID_SURNAME || this.spreadsheetId;
    }
    if (tab === TABS.PERSONS || tab === TABS.RELATIONSHIPS) {
      return process.env.GOOGLE_SHEET_ID_USER || this.spreadsheetId;
    }
    if (tab === TABS.REQUESTS || tab === TABS.AUDIT_LOG || tab === TABS.META || tab === TABS.FAMILY_LINKS) {
      return process.env.GOOGLE_SHEET_ID_ADMIN || this.spreadsheetId;
    }
    return this.spreadsheetId;
  }

  async resolveActualTabName(tab) {
    const sheetId = this.getSpreadsheetId(tab);
    const cacheKey = `${sheetId}_${tab}`;
    if (this.tabNameResolutions.has(cacheKey)) return this.tabNameResolutions.get(cacheKey);

    const TAB_ALIASES = {
      [TABS.SURNAMES]: ['Surnames', 'FT_Surname_Details', 'Surname'],
      [TABS.PERSONS]: ['Persons', 'FT_User_Details', 'Members', 'People'],
      [TABS.RELATIONSHIPS]: ['Relationships', 'FT_Relationships', 'Rels'],
      [TABS.REQUESTS]: ['Requests', 'FT_Requests', 'Tickets'],
      [TABS.FAMILY_LINKS]: ['FamilyLinks', 'Family_Links', 'FT_FamilyLinks', 'Links'],
      [TABS.AUDIT_LOG]: ['AuditLog', 'Audit_Log', 'FT_Admin', 'Audit'],
      [TABS.META]: ['Meta', 'FT_Admin_Meta', 'Config']
    };

    try {
      const meta = await this.sheetsApi.spreadsheets.get({ spreadsheetId: sheetId });
      const titles = (meta.data.sheets || []).map(s => s.properties?.title);

      // If exact tab name exists, use it
      if (titles.includes(tab)) {
        this.tabNameResolutions.set(cacheKey, tab);
        return tab;
      }

      // Check known aliases
      const aliases = TAB_ALIASES[tab] || [];
      for (const alias of aliases) {
        if (titles.includes(alias)) {
          this.tabNameResolutions.set(cacheKey, alias);
          return alias;
        }
      }

      // If only 1 sheet exists (e.g. Sheet1), automatically rename it to tab name
      if (titles.length === 1 && (titles[0] === 'Sheet1' || titles[0] === 'Sheet 1')) {
        const firstSheetId = meta.data.sheets[0].properties.sheetId;
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: firstSheetId, title: tab },
                fields: 'title'
              }
            }]
          }
        });
        this.tabNameResolutions.set(cacheKey, tab);
        return tab;
      }

      // Otherwise create the tab if not present
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
      });
      this.tabNameResolutions.set(cacheKey, tab);
      return tab;
    } catch {
      return tab;
    }
  }

  async ensureTabsAndHeaders() {
    const tabsToInit = Object.values(TABS);
    for (const tab of tabsToInit) {
      const sheetId = this.getSpreadsheetId(tab);
      if (!sheetId) continue;
      try {
        const resolvedTab = await this.resolveActualTabName(tab);
        const reqHeaders = HEADERS[tab] || [];
        const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${resolvedTab}'!1:1` });
        if (!res.data.values || res.data.values.length === 0) {
          await this.sheetsApi.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'${resolvedTab}'!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [reqHeaders] }
          });
          this.headerMaps.set(`${sheetId}_${tab}`, createHeaderMap(reqHeaders));
        } else {
          this.headerMaps.set(`${sheetId}_${tab}`, createHeaderMap(res.data.values[0]));
        }
      } catch (err) {
        console.warn(`Tab ${tab} init:`, err.message);
      }
    }
    return true;
  }

  async getHeaderMap(tab) {
    const sheetId = this.getSpreadsheetId(tab);
    const cacheKey = `${sheetId}_${tab}`;
    if (this.headerMaps.has(cacheKey)) return this.headerMaps.get(cacheKey);
    try {
      const resolvedTab = await this.resolveActualTabName(tab);
      const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${resolvedTab}'!1:1` });
      let headers = res.data.values?.[0] ? [...res.data.values[0]] : [...(HEADERS[tab] || [])];
      let updatedHeaders = false;

      // Auto-append missing columns
      const required = HEADERS[tab] || [];
      for (const col of required) {
        if (!headers.includes(col)) {
          headers.push(col);
          updatedHeaders = true;
        }
      }

      if (updatedHeaders) {
        try {
          await this.sheetsApi.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'${resolvedTab}'!1:1`,
            valueInputOption: 'RAW',
            requestBody: { values: [headers] }
          });
        } catch (_) {}
      }

      const map = createHeaderMap(headers);
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
    const resolvedTab = await this.resolveActualTabName(tab);
    const map = await this.getHeaderMap(tab);
    const res = await this.sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${resolvedTab}'!A:ZZ` });
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
    const resolvedTab = await this.resolveActualTabName(tab);
    const map = await this.getHeaderMap(tab);
    const headers = Array.from(map.keys());
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    const rowValues = objectToRow(sanitized, headers);
    const res = await this.sheetsApi.spreadsheets.values.append({
      spreadsheetId: sheetId, range: `'${resolvedTab}'!A1`, valueInputOption: 'RAW', requestBody: { values: [rowValues] }
    });
    const match = (res.data.updates?.updatedRange || '').match(/!A(\d+):/);
    return { ...sanitized, __rowIndex: match ? parseInt(match[1], 10) : null };
  }

  async updateRow(tab, rowIndex, obj) {
    const sheetId = this.getSpreadsheetId(tab);
    const resolvedTab = await this.resolveActualTabName(tab);
    const map = await this.getHeaderMap(tab);
    const headers = Array.from(map.keys());
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) sanitized[k] = sanitizeFormula(v);
    const rowValues = objectToRow(sanitized, headers);
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: sheetId, range: `'${resolvedTab}'!A${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [rowValues] }
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
  if (process.env.NODE_ENV === 'test' && process.env.USE_LIVE_SHEETS !== 'true') {
    instance = new InMemorySheetsProvider();
    return instance;
  }
  const sheetId = process.env.GOOGLE_SHEET_ID_SURNAME || process.env.GOOGLE_SHEET_ID_USER || process.env.GOOGLE_SHEET_ID_ADMIN || process.env.GOOGLE_SHEET_ID;
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sheetId && sa) {
    try {
      const creds = sa.trim().startsWith('{') ? JSON.parse(sa) : JSON.parse(Buffer.from(sa, 'base64').toString('utf8'));
      if (creds && creds.client_email && typeof creds.private_key === 'string' && creds.private_key.includes('BEGIN PRIVATE KEY')) {
        instance = new GoogleSheetsProvider(sheetId, creds);
        return instance;
      }
    } catch {}
  }
  instance = new InMemorySheetsProvider();
  return instance;
}
export function setSheetsClient(c) { instance = c; }
export { InMemorySheetsProvider, GoogleSheetsProvider };
