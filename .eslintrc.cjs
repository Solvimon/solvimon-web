/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: [
        'plugin:vue/vue3-essential',
        'eslint:recommended',
        '@vue/eslint-config-typescript',
        'plugin:import/recommended',
        '@solvimon/eslint-config',
        'prettier',
    ],
    plugins: ['@html-eslint', 'unused-imports', 'no-relative-import-paths'],
    parserOptions: {
        ecmaVersion: 'latest',
        parser: '@typescript-eslint/parser', // Specify TypeScript parser for `<script lang="ts">`
        project: ['./tsconfig.json', './tsconfig.config.json'],
    },
    overrides: [
        {
            files: ['**/__tests__/*.{j,t}s?(x)', '**/tests/unit/**/*.spec.{j,t}s?(x)'],
            env: {
                jest: true,
            },
        },
    ],
    rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        'no-console': 'error',
        'no-relative-import-paths/no-relative-import-paths': [
            'error',
            { allowSameFolder: true, rootDir: 'src', prefix: '@' },
        ],
        'vue/attribute-hyphenation': [
            'error',
            'always',
            {
                ignore: [],
            },
        ],
        'vue/multi-word-component-names': 'off',
        'vue/component-name-in-template-casing': [
            'error',
            'PascalCase',
            {
                ignores: ['component'],
            },
        ],
        'vue/no-restricted-html-elements': ['error', 'pre'],
        'vue/no-undef-components': [
            'error',
            {
                ignorePatterns: ['RouterView', 'RouterLink'],
            },
        ],
        'vue/attributes-order': 'error',
        'no-undef': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
        'unused-imports/no-unused-imports': 'error',
        'no-setter-return': 'off',
        'import/no-relative-packages': 'error',
        'import/order': [
            'error',
            {
                pathGroups: [
                    {
                        pattern: '@/**',
                        group: 'internal',
                        position: 'after',
                    },
                ],
            },
        ],
    },
    settings: {
        'import/resolver': {
            typescript: {
                project: [
                    'tsconfig.json',
                    'tsconfig.vitest.json',
                    // Duplicate tsconfigs for editor: https://stackoverflow.com/questions/69932369/setting-up-eslint-import-resolver-typescript-in-monorepo#answer-70069522
                    'packages/sdk/tsconfig.json',
                    'packages/sdk/tsconfig.vitest.json',
                ],
            },
        },
    },
};
