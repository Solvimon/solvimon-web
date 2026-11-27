import solvimonTailwindConfig from '@solvimon/tailwind-config';

/** @type {import('tailwindcss').Config} */
export default {
    presets: [solvimonTailwindConfig],
    content: [
        // SDK source files
        'src/**/*.{vue,ts}',
        // solvimon-ui ships compiled JS only (no Vue sources in dist), so scan the dist bundles. Its dist also
        // carries a bundled tailwind-merge whose source lists every Tailwind class; scanning it would generate them all.
        './node_modules/@solvimon/solvimon-ui/dist/*.{js,mjs}',
        './node_modules/@solvimon/solvimon-ui/dist/!(node_modules)/**/*.{js,mjs}',
    ],
};
