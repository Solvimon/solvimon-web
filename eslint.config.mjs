import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';
import formatjs from 'eslint-plugin-formatjs';
import unusedImports from 'eslint-plugin-unused-imports';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import importPlugin from 'eslint-plugin-import';

export default defineConfigWithVueTs(
    globalIgnores([
        '**/*.spec.ts',
        '**/*.cy.ts',
        '**/__tests__/*.{ts,js}',
        '**/dist/**',
        '**/node_modules/**',
        '**/examples/**',
        '**/.nuxt/**',
        '**/.output/**',
        '**/.turbo/**',
    ]),

    pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,
    {
        files: ['**/*.ts', '**/*.vue'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.node,
            },
            parserOptions: {
                parser: '@typescript-eslint/parser',
                tsconfigRootDir: import.meta.dirname,
                ecmaVersion: 'latest',
            },
        },

        plugins: {
            formatjs,
            'unused-imports': unusedImports,
            'no-relative-import-paths': noRelativeImportPaths,
            import: importPlugin,
        },

        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            // If you have unused vars, you can ignore them using the '_' prefix -> _error
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
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
    },
);
