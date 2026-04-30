#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'http';
import { TEST_APP_HOST, TEST_APP_PORT } from '../global.config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'fixtures');

// Try multiple possible node_modules locations (monorepo structure)
const ROOT_NODE_MODULES = path.join(__dirname, '..', '..', '..', 'node_modules');
const PACKAGES_NODE_MODULES = path.join(__dirname, '..', '..', 'node_modules');
const LOCAL_NODE_MODULES = path.join(__dirname, '..', 'node_modules');
const UI_DIST_DIR = path.join(__dirname, '..', '..', 'ui', 'dist');

// Helper to find a file in node_modules
function findInNodeModules(relativePath: string): string | null {
    const paths = [
        path.join(LOCAL_NODE_MODULES, relativePath),
        path.join(PACKAGES_NODE_MODULES, relativePath),
        path.join(ROOT_NODE_MODULES, relativePath),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    let filePath = '';

    // Serve the test HTML from fixtures directory
    // This is the HTML file that will be visible in Playwright UI (test:e2e:ui)
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(FIXTURES_DIR, 'index.html');
    } else if (req.url?.startsWith('/dist/')) {
        // Serve built files from dist
        filePath = path.join(__dirname, '..', req.url);
    } else if (req.url?.startsWith('/node_modules/')) {
        // Serve from node_modules (for Vue and other dependencies)
        const relativePath = req.url.replace('/node_modules/', '');
        const foundPath = findInNodeModules(relativePath);
        if (foundPath) {
            filePath = foundPath;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(
                `Not Found: ${req.url}\nSearched in: ${LOCAL_NODE_MODULES}, ${PACKAGES_NODE_MODULES}, ${ROOT_NODE_MODULES}`,
            );
            return;
        }
    } else if (req.url?.startsWith('/@solvimon/solvimon-ui')) {
        // Serve @solvimon/solvimon-ui from its dist directory
        const uiPath = req.url.replace('/@solvimon/solvimon-ui', '') || '/main.es.js';
        filePath = path.join(UI_DIST_DIR, uiPath);
    } else if (req.url?.startsWith('//solvimon-types')) {
        // /solvimon-types is just TypeScript types, serve an empty module
        // In practice, this won't be needed at runtime, but we handle it for completeness
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('export {};');
        return;
    } else {
        // Try to serve from fixtures or dist
        const fixturePath = path.join(FIXTURES_DIR, req.url || '');
        const distPath = path.join(DIST_DIR, req.url || '');

        if (fs.existsSync(fixturePath)) {
            filePath = fixturePath;
        } else if (fs.existsSync(distPath)) {
            filePath = distPath;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // eslint-disable-next-line no-console
        console.error(`File not found: ${filePath} (requested: ${req.url})`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not Found: ${req.url}\nExpected path: ${filePath}`);
        return;
    }

    // Get file extension and set content type
    const ext = path.extname(filePath);

    // If a CSS file is being imported as a JavaScript module, return an empty JS module
    // This happens when CSS is imported in JS/TS files (even with ?inline, the browser may still try to fetch it)
    if (ext === '.css') {
        const acceptHeader = req.headers.accept || '';
        // Module script requests typically include application/javascript or text/javascript in Accept header
        // Regular stylesheet requests typically include text/css
        const isModuleRequest =
            acceptHeader.includes('application/javascript') ||
            acceptHeader.includes('text/javascript');

        if (isModuleRequest) {
            // CSS file requested as a module - return empty JS module
            // The CSS should already be inlined in the bundle via ?inline query parameter
            res.writeHead(200, {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'no-cache',
            });
            res.end(
                '// CSS file imported as module - styles are inlined in the bundle\nexport {};',
            );
            return;
        }
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve the file
    fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Test server running at http://${TEST_APP_HOST}:${TEST_APP_PORT}/`);
});
