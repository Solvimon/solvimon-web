#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testAppDir = path.join(__dirname, '../tests/app');

console.log(`Starting test app server in ${testAppDir}...`);

const child = spawn('npm', ['run', 'dev'], {
    cwd: testAppDir,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
    },
});

const cleanup = () => {
    if (child.pid) {
        try {
            child.kill('SIGTERM');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            // ignore errors during cleanup
        }
    }
    process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error(`Server process exited with code ${code}`);
    }
    process.exit(code || 0);
});

child.on('error', (error) => {
    console.error('Error spawning server process:', error);
    process.exit(1);
});
