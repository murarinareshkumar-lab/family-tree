import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { HEADERS, TABS } from '../lib/schema.js';

console.log('Generating Family_Tree_Database.xlsx with all 8 tabs...');

const wb = XLSX.utils.book_new();

for (const [tabKey, tabName] of Object.entries(TABS)) {
  const headers = HEADERS[tabName] || [];
  const rows = [];

  // For meta tab, seed initial system keys
  if (tabName === TABS.META) {
    const now = new Date().toISOString();
    rows.push({
      key: 'ID_LOCK',
      value: 'UNLOCKED',
      updated_at: now,
      notes: 'Mutex lock for atomic ID generation'
    });
    rows.push({
      key: 'SCHEMA_VERSION',
      value: '4.0',
      updated_at: now,
      notes: 'Family Tree schema version'
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Set column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 15) }));

  XLSX.utils.book_append_sheet(wb, ws, tabName);
}

const outputPath1 = path.resolve('Family_Tree_Database.xlsx');
XLSX.writeFile(wb, outputPath1);
console.log(`Generated: ${outputPath1}`);

// Also copy to active workspace Downloads folder
const workspaceDir = 'C:\\Users\\admin\\Downloads\\Murari_portfolio\\Murari_portfolio';
if (fs.existsSync(workspaceDir)) {
  const outputPath2 = path.join(workspaceDir, 'Family_Tree_Database.xlsx');
  XLSX.writeFile(wb, outputPath2);
  console.log(`Copied to workspace: ${outputPath2}`);
}

// Generate CSV export folder for quick viewing/import
const csvDir = path.resolve('sheets_csv');
if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

for (const [tabKey, tabName] of Object.entries(TABS)) {
  const ws = wb.Sheets[tabName];
  const csvData = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(path.join(csvDir, `${tabName}.csv`), csvData, 'utf8');
}
console.log(`Exported all CSVs to: ${csvDir}`);
console.log('Done!');
