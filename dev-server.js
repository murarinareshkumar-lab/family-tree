import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import app from './server/app.js';
dotenv.config();

const PORT = process.env.API_PORT || 3001;

// CORS headers for local development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-admin-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.listen(PORT, () => {
  console.log(`Family Tree Express API running on :${PORT}`);
  const viteCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  spawn(viteCmd, ['--prefix', 'client', 'run', 'dev'], { stdio: 'inherit', shell: true });
});
