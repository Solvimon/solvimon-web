import { join } from 'path';
import { fileURLToPath } from 'url';
import solvimonTailwindConfig from '@solvimon/tailwind-config';
import uiPackageTailwindConfig from '@solvimon/solvimon-ui/tailwind.config';

/** @type {import('tailwindcss').Config} */

// Recreate __dirname in ESM
const __dirname = fileURLToPath(new URL('.', import.meta.url));

module.exports = {
    ...solvimonTailwindConfig,
    content: [
        'src/**/*.{vue,ts}',
        ...uiPackageTailwindConfig.content.map((contentPath) =>
            join(__dirname, `../../node_modules/@solvimon/solvimon-ui/${contentPath}`),
        ),
    ],
};
