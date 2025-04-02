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
        'prettier',
        'plugin:storybook/recommended',
        'plugin:import/recommended',
        '@solvimon/eslint-config',
    ],
    plugins: ['@html-eslint', 'formatjs', 'unused-imports', 'prettier', 'no-relative-import-paths'],
    parserOptions: {
        ecmaVersion: 'latest',
    },
    overrides: [
        {
            files: ['*.html'],
            parser: '@html-eslint/parser',
            extends: ['plugin:@html-eslint/recommended'],
        },
        {
            files: ['**/__tests__/*.{j,t}s?(x)', '**/tests/unit/**/*.spec.{j,t}s?(x)'],
            env: {
                jest: true,
            },
        },
    ],
    rules: {
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
        'formatjs/enforce-default-message': ['error', 'literal'],
        'formatjs/no-multiple-whitespaces': ['error'],
        'formatjs/no-camel-case': ['error'],
        'formatjs/enforce-id': [
            'error',
            {
                idInterpolationPattern: '[sha512:contenthash:base64:6]',
            },
        ],
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
