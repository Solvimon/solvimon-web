import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { resolveSafePath } from './safe-path.mjs';
import { glob } from 'glob';
import { isStructurallySame, parse } from '@formatjs/icu-messageformat-parser';
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

/**
 * Why `translation` cannot stand in for `source`: a placeholder, plural, select or tag that one has
 * and the other lacks, or a message that does not parse. Undefined when it can.
 */
export function findPlaceholderMismatch(source, translation) {
    try {
        const { success, error } = isStructurallySame(parse(source), parse(translation));
        return success ? undefined : error.message;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/** @param {Record<string, string>} sourceMessages - the default message of every id in the catalogue */
export function checkTranslations(sourceMessages, localeFiles, readFile) {
    return localeFiles.map((file) => {
        const locale = parseTranslationFile(readFile(file), file);
        const missingKeys = Object.keys(sourceMessages).filter((key) => !(key in locale));
        const extraKeys = Object.keys(locale).filter((key) => !(key in sourceMessages));
        const placeholderMismatches = Object.entries(sourceMessages).flatMap(([key, source]) => {
            if (!(key in locale)) return [];
            const reason = findPlaceholderMismatch(source, locale[key]);
            return reason ? [{ key, reason }] : [];
        });
        return { file, missingKeys, extraKeys, placeholderMismatches };
    });
}

/** The locale files to check, or the locales whose file name could not be resolved safely. */
export function resolveLocaleFiles(locales, localesDir) {
    const files = [];
    const rejected = [];
    for (const locale of locales) {
        try {
            files.push(resolveSafePath(`${locale}.json`, localesDir));
        } catch {
            rejected.push(locale);
        }
    }
    return { files, rejected };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const translationsDir = path.join(__dirname, '../src/translations');
    const localesDir = path.join(translationsDir, 'locales');

    const source = JSON.parse(fs.readFileSync(path.join(translationsDir, 'source.json'), 'utf-8'));
    const sourceMessages = Object.fromEntries(
        Object.entries(source).map(([key, { defaultMessage }]) => [key, defaultMessage]),
    );

    const { files, rejected } = resolveLocaleFiles(SUPPORTED_LOCALES, localesDir);
    rejected.forEach((locale) => console.log(`❌ Locale "${locale}" does not name a safe file`));

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

    const results = checkTranslations(sourceMessages, files, (f) => fs.readFileSync(f, 'utf-8'));

    let hasProblems = rejected.length > 0 || duplicates.length > 0;
    for (const { file, missingKeys, extraKeys, placeholderMismatches } of results) {
        const name = path.basename(file);
        if (missingKeys.length > 0) {
            console.log(`❌ Missing keys in ${name}:`);
            missingKeys.forEach((key) => console.log(`  - ${key}`));
        }
        if (extraKeys.length > 0) {
            console.log(`❌ Keys in ${name} that source.json does not have:`);
            extraKeys.forEach((key) => console.log(`  - ${key}`));
        }
        if (placeholderMismatches.length > 0) {
            console.log(`❌ Messages in ${name} whose placeholders differ from source.json:`);
            placeholderMismatches.forEach(({ key, reason }) =>
                console.log(`  - ${key}: ${reason}`),
            );
        }
        if (missingKeys.length + extraKeys.length + placeholderMismatches.length === 0) {
            console.log(`✅ ${name} is complete!`);
        } else {
            hasProblems = true;
        }
    }

    if (hasProblems) process.exit(1);
}
