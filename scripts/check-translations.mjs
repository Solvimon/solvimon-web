import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { resolveSafePath } from './safe-path.mjs';
import { glob } from 'glob';
import { SUPPORTED_LOCALES } from '../src/translations/supported.js';

export function isTranslationRecord(value) {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((translation) => typeof translation === 'string')
    );
}

export function parseTranslationFile(content, file) {
    const parsed = JSON.parse(content);

    if (!isTranslationRecord(parsed)) {
        throw new Error(
            `Invalid translation file ${file}: expected a JSON object with string values`,
        );
    }

    return parsed;
}

const MESSAGE_PATTERNS = [
    /\{\s*defaultMessage:\s*(?<quote>['"`])(?<message>[\s\S]*?)\k<quote>[\s\S]*?id:\s*'(?<id>[^']+)'/g,
    /\{\s*id:\s*'(?<id>[^']+)'[\s\S]*?defaultMessage:\s*(?<quote>['"`])(?<message>[\s\S]*?)\k<quote>/g,
];

export function findMessages(content) {
    return MESSAGE_PATTERNS.flatMap((pattern) =>
        [...content.matchAll(pattern)].map(({ groups }) => ({
            id: groups.id,
            message: groups.message,
        })),
    );
}

export function findDuplicateMessageIds(files, readFile) {
    const byId = new Map();

    for (const file of files) {
        for (const { id, message } of findMessages(readFile(file))) {
            if (!byId.has(id)) byId.set(id, new Map());
            const messages = byId.get(id);
            if (!messages.has(message)) messages.set(message, file);
        }
    }

    return [...byId]
        .filter(([, messages]) => messages.size > 1)
        .map(([id, messages]) => ({
            id,
            messages: [...messages].map(([message, file]) => ({ message, file })),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

export function checkTranslations(sourceKeys, localeFiles, readFile) {
    return localeFiles.map((file) => {
        const locale = parseTranslationFile(readFile(file), file);
        const missingKeys = sourceKeys.filter((key) => !(key in locale));
        return { file, missingKeys };
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const translationsDir = path.join(__dirname, '../src/translations');
    const localesDir = path.join(translationsDir, 'locales');

    const source = JSON.parse(fs.readFileSync(path.join(translationsDir, 'source.json'), 'utf-8'));
    const sourceKeys = Object.keys(source);

    const files = SUPPORTED_LOCALES.map((locale) => {
        try {
            return resolveSafePath(`${locale}.json`, localesDir);
        } catch {
            console.error(`⚠️ Skipping suspicious locale: ${locale}`);
            return null;
        }
    }).filter(Boolean);

    const sourceFiles = glob
        .sync('src/**/*.{ts,vue}', { cwd: path.join(__dirname, '..'), absolute: true })
        .filter((file) => !file.includes('.spec.'));

    const duplicates = findDuplicateMessageIds(sourceFiles, (f) => fs.readFileSync(f, 'utf-8'));

    for (const { id, messages } of duplicates) {
        console.log(`❌ Duplicate message id "${id}" with different messages:`);
        messages.forEach(({ message, file }) =>
            console.log(`  - ${JSON.stringify(message)} in ${path.relative(process.cwd(), file)}`),
        );
    }

    if (duplicates.length === 0) {
        console.log('✅ Every message id carries one message.');
    }

    const results = checkTranslations(sourceKeys, files, (f) => fs.readFileSync(f, 'utf-8'));

    let hasMissing = false;
    for (const { file, missingKeys } of results) {
        if (missingKeys.length > 0) {
            hasMissing = true;
            console.log(`❌ Missing keys in ${path.basename(file)}:`);
            missingKeys.forEach((key) => console.log(`  - ${key}`));
        } else {
            console.log(`✅ ${path.basename(file)} is complete!`);
        }
    }

    if (hasMissing || duplicates.length > 0) process.exit(1);
}
