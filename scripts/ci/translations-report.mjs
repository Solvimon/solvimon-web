import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveSafePath } from '../safe-path.mjs';
import { SUPPORTED_LOCALES } from '../../src/translations/supported.js';

export function generateTranslationsReport({ translationsDir, supported, sha }) {
    const sourceKeys = Object.keys(
        JSON.parse(readFileSync(path.join(translationsDir, 'source.json'), 'utf8')),
    );

    const localesDir = path.join(translationsDir, 'locales');
    const results = supported.map((locale) => {
        let filePath;
        try {
            filePath = resolveSafePath(`${locale}.json`, localesDir);
        } catch {
            return { locale, missingKeys: [], rejected: true };
        }
        let translations = {};
        if (existsSync(filePath)) {
            translations = JSON.parse(readFileSync(filePath, 'utf8'));
        }
        const missingKeys = sourceKeys.filter((key) => !(key in translations));
        return { locale, missingKeys, rejected: false };
    });

    const localesWithMissing = results.filter((r) => r.missingKeys.length > 0);
    const rejectedLocales = results.filter((r) => r.rejected);

    let summaryLines;
    if (localesWithMissing.length === 0 && rejectedLocales.length === 0) {
        summaryLines = ['> [!NOTE]', `> All ${supported.length} locales are fully translated ✅`];
    } else {
        const list = (rs) => rs.map((r) => `**${r.locale}**`).join(', ');
        summaryLines = [
            '> [!CAUTION]',
            ...(localesWithMissing.length > 0
                ? [`> Missing translations in: ${list(localesWithMissing)}`]
                : []),
            ...(rejectedLocales.length > 0
                ? [`> Not checked, the name is not a safe file name: ${list(rejectedLocales)}`]
                : []),
        ];
    }

    const sections = results.flatMap(({ locale, missingKeys, rejected }) => {
        if (rejected) {
            return [
                `<details>\n<summary><strong>${locale}</strong> — not checked ❌</summary>\n</details>`,
                '',
            ];
        }

        if (missingKeys.length === 0) {
            return [
                `<details>\n<summary><strong>${locale}</strong> — complete ✅</summary>\n</details>`,
                '',
            ];
        }

        const n = missingKeys.length;
        const rows = missingKeys.map((key) => `| \`${key}\` |`);
        return [
            `<details>\n<summary><strong>${locale}</strong> — ${n} key${n > 1 ? 's' : ''} missing</summary>`,
            '',
            '| Key |',
            '|:---|',
            ...rows,
            '',
            '</details>',
            '',
        ];
    });

    return [
        '<!-- translations-report -->',
        '## Translation Coverage Report',
        '',
        ...summaryLines,
        '',
        ...sections,
        `<sub>Measured at ${sha}</sub>`,
    ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const get = (flag) => args[args.indexOf(flag) + 1];

    console.log(
        generateTranslationsReport({
            translationsDir: get('--translations-dir'),
            supported: SUPPORTED_LOCALES,
            sha: get('--sha'),
        }),
    );
}
