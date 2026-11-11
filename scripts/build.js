import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- Building Family Tree Portal ---');

// Sync api, server and lib into client so both root deployment and client-subfolder deployment work identically on Vercel
try {
  if (fs.existsSync('api')) {
    fs.cpSync('api', 'client/api', { recursive: true, force: true });
  }
  if (fs.existsSync('server')) {
    fs.cpSync('server', 'client/server', { recursive: true, force: true });
  }
  if (fs.existsSync('lib')) {
    fs.cpSync('lib', 'client/lib', { recursive: true, force: true });
  }
  if (fs.existsSync('vercel.json')) {
    fs.copyFileSync('vercel.json', 'client/vercel.json');
  }
} catch (e) {
  console.warn('Sync warning:', e.message);
}

if (!fs.existsSync('client/node_modules')) {
  console.log('1. Installing client dependencies...');
  try {
    execSync('npm --prefix client install --no-audit --no-fund', { stdio: 'inherit' });
  } catch (e) {
    console.warn('npm install warning:', e.message);
  }
} else {
  console.log('1. Client dependencies already installed.');
}

console.log('2. Compiling Vite React app...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('3. Synchronizing output folders...');
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

if (fs.existsSync('client/dist')) {
  fs.cpSync('client/dist', 'dist', { recursive: true });
}

if (fs.existsSync('dist') && !fs.existsSync('client/dist')) {
  fs.cpSync('dist', 'client/dist', { recursive: true });
}

console.log('--- Verification ---');
console.log('dist exists:', fs.existsSync('dist/index.html'));
console.log('client/dist exists:', fs.existsSync('client/dist/index.html'));
console.log('--- Build Succeeded! ---');
