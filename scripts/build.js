import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- Building Family Tree Portal ---');

console.log('1. Installing client dependencies...');
execSync('npm --prefix client install', { stdio: 'inherit' });

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
