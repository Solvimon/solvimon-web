import { normalizeCssOverrides } from './CssOverridesProvider.lib';

/**
 * Which `@import` rules are dropped is decided by the browser's CSS parser, which jsdom does not
 * have; `tests/playwright/e2e/css-overrides.spec.ts` checks that part in Chromium.
 */
describe('normalizeCssOverrides', () => {
    it('is empty without overrides', () => {
        expect(normalizeCssOverrides(undefined)).toBe('');
        expect(normalizeCssOverrides([])).toBe('');
    });

    it('joins a list into one block, skipping empty entries', () => {
        expect(normalizeCssOverrides(['.a { color: red; }', '', '.b { color: blue; }'])).toBe(
            '.a { color: red; }\n.b { color: blue; }',
        );
    });

    it('leaves CSS without an at-rule exactly as written', () => {
        const css = '.a::before { content: "x"; }\n.b{color:red}';

        expect(normalizeCssOverrides(`  ${css}\n`)).toBe(css);
    });

    it('leaves the CSS as written where there is no parser to ask', () => {
        const css = '@import "theme.css";\n.a { color: red; }';

        expect(normalizeCssOverrides(css)).toBe(css);
    });
});
