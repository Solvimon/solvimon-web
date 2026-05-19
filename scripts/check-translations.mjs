import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

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

    const source = JSON.parse(fs.readFileSync(path.join(translationsDir, 'source.json'), 'utf-8'));
    const sourceKeys = Object.keys(source);

    const supported = JSON.parse(
        fs.readFileSync(path.join(translationsDir, 'supported.json'), 'utf-8'),
    );

    const files = supported
        .map((locale) => {
            const filePath = path.normalize(path.join(translationsDir, `${locale}.json`));
            if (!filePath.startsWith(translationsDir + path.sep)) {
                console.error(`⚠️ Skipping suspicious locale: ${locale}`);
                return null;
            }
            return filePath;
        })
        .filter(Boolean);

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

    if (hasMissing) process.exit(1);
}
