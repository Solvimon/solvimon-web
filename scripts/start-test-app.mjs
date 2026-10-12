#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testAppDir = path.join(__dirname, '../tests/app');
const viteBin = path.join(testAppDir, 'node_modules/vite/bin/vite.js');

console.log(`Starting test app server in ${testAppDir}...`);

// Vite is run directly rather than through `npm run dev` in a shell: a signal sent to a shell or
// to npm does not reliably reach the server, which then outlives the run and holds the port.
const child = spawn(process.execPath, [viteBin], {
    cwd: testAppDir,
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
    },
});

let stopping = false;

const stop = (signal) => {
    stopping = true;
    child.kill(signal);
};

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

child.on('exit', (code, signal) => {
    if (stopping) process.exit(0);

    console.error(`Test app server stopped unexpectedly (${signal ?? `exit code ${code}`})`);
    process.exit(code || 1);
});

child.on('error', (error) => {
    console.error('Error spawning server process:', error);
    process.exit(1);
});
