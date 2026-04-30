import { join } from 'path';
import { fileURLToPath } from 'url';
import defaultTheme from 'tailwindcss/defaultTheme';
import solvimonTailwindConfig from './tailwind.config'
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
        theme: {
        extend: {
            fontSize: {
                '2xs': ['0.65rem', '0.9rem'],
            },
                fontFamily: {
                    inter: ['inter', ...defaultTheme.fontFamily.sans],
                },
            colors: {
                primary: {
                    50: 'var(--color-primary-50)',
                    100: 'var(--color-primary-100)',
                    200: 'var(--color-primary-200)',
                    300: 'var(--color-primary-300)',
                    400: 'var(--color-primary-400)',
                    500: 'var(--color-primary-500)',
                    600: 'var(--color-primary-600)',
                    700: 'var(--color-primary-700)',
                    800: 'var(--color-primary-800)',
                    900: 'var(--color-primary-900)',
                },
                secondary: {
                    50: 'var(--color-secondary-50)',
                    100: 'var(--color-secondary-100)',
                    200: 'var(--color-secondary-200)',
                    300: 'var(--color-secondary-300)',
                    400: 'var(--color-secondary-400)',
                    500: 'var(--color-secondary-500)',
                    600: 'var(--color-secondary-600)',
                    700: 'var(--color-secondary-700)',
                    800: 'var(--color-secondary-800)',
                    900: 'var(--color-secondary-900)',
                },
                gray: {
                    50: '#F3F4F6',
                    100: '#EEEFF2',
                    900: '#111928',
                },
                peach: {
                    100: '#FF6200',
                },
                mint: {
                    100: '#00FEF9',
                },
            },
            width: {},
            maxWidth: {
                'screen-3xl': '1800px',
            },
        },
    },
};
