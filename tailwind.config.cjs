import { join } from 'path';
import solvimonTailwindConfig from '@solvimon/tailwind-config';
import uiPackageTailwindConfig from '@solvimon/ui/tailwind.config';
import { fileURLToPath } from 'url';

/** @type {import('tailwindcss').Config} */
const __dirname = fileURLToPath(new URL('.', import.meta.url));


module.exports = {
    ...solvimonTailwindConfig,
    content: [
        'src/**/*.{vue,ts}',
        ...uiPackageTailwindConfig.content.map((contentPath) =>
            join(__dirname, `../../node_modules/@solvimon/ui/${contentPath}`),
        ),
    ],
};
