import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const rootDirectory = join(fileURLToPath(new URL('..', import.meta.url)));
const workerDirectory = join(rootDirectory, 'workers', 'video-token');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(process.execPath, [join(rootDirectory, 'scripts', 'dev-server.mjs')], {
    cwd: rootDirectory,
    stdio: 'inherit',
  }),
  spawn(npmCommand, ['run', 'dev'], {
    cwd: workerDirectory,
    stdio: 'inherit',
    shell: true,
  }),
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  setTimeout(() => process.exit(code), 500);
}

for (const child of children) {
  child.on('error', () => shutdown(1));
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code ?? 0) !== 0 && signal !== 'SIGINT') shutdown(code || 1);
  });
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

console.log('Local portfolio started: site http://localhost:8000 + Worker http://localhost:8787');
