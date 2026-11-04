import http from 'node:http';
import { parse } from 'node:url';
import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
dotenv.config();

const routeMap = {
  '/api/health': () => import('./api/health.js'),
  '/api/surnames': () => import('./api/surnames.js'),
  '/api/tree': () => import('./api/tree.js'),
  '/api/requests': () => import('./api/requests/index.js'),
  '/api/requests/status': () => import('./api/requests/status.js'),
  '/api/admin/login': () => import('./api/admin/login.js'),
  '/api/admin/logout': () => import('./api/admin/logout.js'),
  '/api/admin/me': () => import('./api/admin/me.js'),
  '/api/admin/dashboard': () => import('./api/admin/dashboard.js'),
  '/api/admin/requests': () => import('./api/admin/requests.js'),
  '/api/admin/members': () => import('./api/admin/members.js'),
  '/api/admin/duplicates': () => import('./api/admin/duplicates.js'),
  '/api/admin/merge': () => import('./api/admin/merge.js'),
  '/api/admin/audit': () => import('./api/admin/audit.js'),
  '/api/admin/export': () => import('./api/admin/export.js')
};

const PORT = process.env.API_PORT || 3001;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const parsedUrl = parse(req.url, true);
  const pathname = parsedUrl.pathname.replace(/\/$/, '') || '/';
  const route = routeMap[pathname];
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `Route not found: ${pathname}` }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    req.query = parsedUrl.query;
    try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = body; }
    try {
      const mod = await route();
      await mod.default(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Family Tree API running on :${PORT}`);
  const viteCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  spawn(viteCmd, ['--prefix', 'client', 'run', 'dev'], { stdio: 'inherit', shell: true });
});
