#!/usr/bin/env node

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the dev server - Playwright will poll the URL until it's available
const testAppDir = path.join(__dirname, '../tests/app');

// eslint-disable-next-line no-console
console.log(`Starting test app server in ${testAppDir}...`);

// Start the dev server using npm run dev
const child: ChildProcess = spawn('npm', ['run', 'dev'], {
    cwd: testAppDir,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
    },
});

// Handle process termination
const cleanup = () => {
    if (child.pid) {
        try {
            child.kill('SIGTERM');
        } catch (_) {
            // Ignore errors during cleanup
        }
    }
    process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        // eslint-disable-next-line no-console
        console.error(`Server process exited with code ${code}`);
    }
    process.exit(code || 0);
});

child.on('error', (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('Error spawning server process:', error);
    process.exit(1);
});

// Keep the process alive - Playwright will poll the URL until it's available
// The server output (via stdio: 'inherit') will show when it's ready
