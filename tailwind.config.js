const solvimonTailwindConfig = require('@solvimon/tailwind-config');
const uiPackageTailwindConfig = require('@solvimon/ui/tailwind.config');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
    ...solvimonTailwindConfig,
    content: [
        'src/**/*.{vue,ts}',
        ...uiPackageTailwindConfig.content.map((contentPath) => join(__dirname, `../../node_modules/@solvimon/ui/${contentPath}`))
    ],
};
