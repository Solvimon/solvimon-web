#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SSL_CERT_DIR = path.join(__dirname, '../tests/app/.cert');
const SSL_CERT_FILE = path.join(SSL_CERT_DIR, 'cert.pem');
const SSL_KEY_FILE = path.join(SSL_CERT_DIR, 'dev.pem');

// Create directory if it doesn't exist
if (!fs.existsSync(SSL_CERT_DIR)) {
    fs.mkdirSync(SSL_CERT_DIR, { recursive: true });
}

// Check if certificates already exist
if (fs.existsSync(SSL_CERT_FILE) && fs.existsSync(SSL_KEY_FILE)) {
    // eslint-disable-next-line no-console
    console.log('SSL certificates already exist');
    process.exit(0);
}

// eslint-disable-next-line no-console
console.log('Generating SSL certificates for localhost...');

try {
    // Generate self-signed certificate using openssl
    // This creates a certificate valid for 365 days
    execSync(
        `openssl req -x509 -newkey rsa:4096 -keyout "${SSL_KEY_FILE}" -out "${SSL_CERT_FILE}" -days 365 -nodes -subj "/C=NL/ST=Test/L=Test/O=Test/CN=localhost"`,
        { stdio: 'inherit' },
    );
    // eslint-disable-next-line no-console
    console.log('SSL certificates generated successfully');
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('Failed to generate SSL certificates:', errorMessage);
    // eslint-disable-next-line no-console
    console.error('Make sure openssl is installed on your system');
    process.exit(1);
}
