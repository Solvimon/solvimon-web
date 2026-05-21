import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';
import formatjs from 'eslint-plugin-formatjs';
import unusedImports from 'eslint-plugin-unused-imports';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import importX from 'eslint-plugin-import-x';

export default defineConfigWithVueTs(
    globalIgnores([
        '**/*.spec.ts',
        '**/*.cy.ts',
        '**/__tests__/*.{ts,js}',
        '**/dist/**',
        '**/node_modules/**',
        '**/.nuxt/**',
        '**/.output/**',
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
            'import-x': importX,
        },

        rules: {
            quotes: ['warn', 'single', { avoidEscape: true }],
            'no-else-return': 'warn',
            'vue/component-name-in-template-casing': [
                'error',
                'PascalCase',
                {
                    registeredComponentsOnly: false,
                },
            ],
            '@typescript-eslint/consistent-type-assertions': [
                'error',
                {
                    assertionStyle: 'never',
                },
            ],
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
                    ignorePatterns: ['RouterView', 'RouterLink', 'solvimon-.*'],
                },
            ],
            'vue/attributes-order': 'error',
            'no-undef': 'off',
            'unused-imports/no-unused-imports': 'error',
            'no-setter-return': 'off',
            'import-x/no-relative-packages': 'error',
            'import-x/order': [
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
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.name='$t'] > ConditionalExpression",
                    message:
                        'Do not pass a conditional message descriptor to $t. Put the condition outside the $t calls so FormatJS can extract both messages.',
                },
                {
                    selector: "CallExpression[callee.name='formatMessage'] > ConditionalExpression",
                    message:
                        'Do not pass a conditional message descriptor to formatMessage. Put the condition outside the formatMessage calls so FormatJS can extract both messages.',
                },
                /**
                 * Lint rules for the logger to make sure static extraction keeps working.
                 */
                {
                    selector:
                        "VariableDeclarator[id.type='ObjectPattern']:matches([init.name='logger'], [init.callee.name='useLogger'])",
                    message:
                        "Do not destructure the logger. Use 'const logger = useLogger()' and call logger.method() directly so log codes can be statically extracted.",
                },
                {
                    selector: "MemberExpression[optional=true][object.name='logger']",
                    message:
                        "Use logger.method() without optional chaining. Guard with 'if (logger)' if logger may be undefined.",
                },
                {
                    selector: "MemberExpression[computed=true][object.name='logger']",
                    message: "Use logger.method() with dot notation only, not logger['method']().",
                },
                {
                    selector:
                        "CallExpression[callee.type='MemberExpression'][callee.object.name='logger'][callee.property.name=/^(error|warn|info|debug)$/]:not([arguments.0.type='Literal'])",
                    message:
                        'The log code (first argument) must be a plain string literal so npm run logs:list can extract it.',
                },
                {
                    selector:
                        "CallExpression[callee.type='MemberExpression'][callee.object.name='logger'][callee.property.name=/^(error|warn|info|debug)$/]:not([arguments.1.type='Literal']):not([arguments.1.type='TemplateLiteral'])",
                    message:
                        'The log message (second argument) must be a string or template literal so npm run logs:list can extract it.',
                },
            ],
        },
    },
    // Override for test app files
    {
        files: ['tests/app/**/*.{ts,vue}'],
        rules: {
            'no-console': 'off',
        },
    },
);
