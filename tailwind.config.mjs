import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindColors from 'tailwindcss/colors';

/**
 * Semantic roles solvimon-ui's components emit classes for (`text-default`, `bg-feedback-info`,
 * …). They are defined in solvimon-ui's own Tailwind config, which the SDK does not inherit, so
 * they are restated here to match it. Without them those classes resolve to nothing and the
 * element takes whatever color it inherits.
 */
const text = {
    default: '#111928',
    secondary: '#374151',
    subtle: '#6B7280',
    placeholder: '#6B7280',
    disabled: '#9CA3AF',
    'feedback-info': tailwindColors.blue[700],
    'feedback-success': tailwindColors.green[700],
    'feedback-warning': tailwindColors.yellow[700],
    'feedback-danger': tailwindColors.red[700],
};

const feedbackBackground = {
    'feedback-neutral': '#F3F4F6',
    'feedback-info': tailwindColors.blue[50],
    'feedback-success': tailwindColors.green[50],
    'feedback-warning': tailwindColors.yellow[50],
    'feedback-danger': tailwindColors.red[50],
    'feedback-neutral-strong': '#374151',
    'feedback-info-strong': tailwindColors.blue[700],
    'feedback-success-strong': tailwindColors.green[700],
    'feedback-warning-strong': tailwindColors.yellow[700],
    'feedback-danger-strong': tailwindColors.red[700],
};

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        // SDK source files
        'src/**/*.{vue,ts}',
        // solvimon-ui ships compiled JS only (no Vue sources in dist), so scan the dist bundles
        './node_modules/@solvimon/solvimon-ui/dist/**/*.{js,mjs}',
        // ...but not its bundled dependencies: they hold no classes, and scanning them is slow.
        // Tailwind resolves the symlinked package to its real path, so the `node_modules` segment
        // disappears from the pattern and it gets flagged as a broad glob.
        '!./node_modules/@solvimon/solvimon-ui/dist/node_modules/**',
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
            textColor: text,
            backgroundColor: feedbackBackground,
            zIndex: {
                60: 60,
                70: 70,
                80: 80,
            },
            width: {},
            maxWidth: {
                'screen-3xl': '1800px',
            },
        },
    },
};
