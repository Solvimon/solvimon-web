import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import source from '../src/translations/source.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const translationsDir = path.join(__dirname, '../src/translations');
const sourceKeys = Object.keys(source);

const files = fs
    .readdirSync(translationsDir)
    .filter((file) => file.endsWith('.json') && file !== 'source.json');

files.forEach((file) => {
    const localePath = path.normalize(path.join(translationsDir, file));

    // Ensure the path is still within the base directory
    if (!localePath.startsWith(translationsDir + path.sep)) {
        // eslint-disable-next-line no-console
        console.error(`⚠️ Skipping suspicious file path: ${file}`);
        return;
    }

    const localeContent = fs.readFileSync(localePath, 'utf-8');

    const locale = JSON.parse(localeContent) as Record<string, string>;
    const missingKeys = sourceKeys.filter((key) => !(key in locale));

    if (missingKeys.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`❌ Missing keys in ${file}:`);
        // eslint-disable-next-line no-console
        missingKeys.forEach((key) => console.log(`  - ${key}`));
    } else {
        // eslint-disable-next-line no-console
        console.log(`✅ ${file} is complete!`);
    }
});
