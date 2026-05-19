import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveSafePath } from '../safe-path.mjs';

export function generateTranslationsReport({ translationsDir, sha }) {
    const sourceKeys = Object.keys(
        JSON.parse(readFileSync(path.join(translationsDir, 'source.json'), 'utf8')),
    );
    const supported = JSON.parse(
        readFileSync(path.join(translationsDir, 'supported.json'), 'utf8'),
    );

    const results = supported.map((locale) => {
        let filePath;
        try {
            filePath = resolveSafePath(`${locale}.json`, translationsDir);
        } catch {
            console.error(`⚠️ Skipping suspicious locale: ${locale}`);
            return { locale, missingKeys: [] };
        }
        let translations = {};
        if (existsSync(filePath)) {
            translations = JSON.parse(readFileSync(filePath, 'utf8'));
        }
        const missingKeys = sourceKeys.filter((key) => !(key in translations));
        return { locale, missingKeys };
    });

    const localesWithMissing = results.filter((r) => r.missingKeys.length > 0);

    let summaryLines;
    if (localesWithMissing.length === 0) {
        summaryLines = ['> [!NOTE]', `> All ${supported.length} locales are fully translated ✅`];
    } else {
        const names = localesWithMissing.map((r) => `**${r.locale}**`).join(', ');
        summaryLines = ['> [!CAUTION]', `> Missing translations in: ${names}`];
    }

    const sections = results.flatMap(({ locale, missingKeys }) => {
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
            sha: get('--sha'),
        }),
    );
}
