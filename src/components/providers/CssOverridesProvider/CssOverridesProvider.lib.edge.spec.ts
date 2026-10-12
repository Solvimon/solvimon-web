import { normalizeCssOverrides } from './CssOverridesProvider.lib';

/**
 * Spellings Chromium parses as a `CSSImportRule` when the result lands in a `<style>` element, the
 * fallback path. Each one was checked by putting the output in a `<style>` and reading its
 * `cssRules`. Marked as expected failures: the regex in `CssOverridesProvider.lib.ts` lets them
 * through (DD-3549).
 */
describe('normalizeCssOverrides — @import spellings a browser still honours', () => {
    it.fails.each([
        ['no whitespace before the string', '@import"theme.css";'],
        ['a comment instead of whitespace', '@import/**/"theme.css";'],
        ['an escaped at-keyword', '@\\69mport "theme.css";'],
        ['an escaped at-keyword with its terminating space', '@\\69 mport "theme.css";'],
        [
            'one rule nested inside another, rejoined by the removal',
            '@im@import "a.css";port "theme.css";',
        ],
    ])('drops it with %s', (_, rule) => {
        const css = normalizeCssOverrides(`${rule}\n.sv-root { color: red; }`);

        expect(css).not.toMatch(/@(?:import|\\69)/i);
        expect(css).toContain('.sv-root { color: red; }');
    });

    it('drops one split over lines', () => {
        expect(normalizeCssOverrides('@import\nurl(theme.css);\n.a { color: red; }')).toBe(
            '.a { color: red; }',
        );
    });
});

describe('normalizeCssOverrides — CSS that only mentions @import', () => {
    it('keeps a data URL that contains the word', () => {
        const css = '.a { background: url("data:image/svg+xml;utf8,<svg>@import</svg>"); }';

        expect(normalizeCssOverrides(css)).toBe(css);
    });

    it.fails('keeps a string value that contains an @import, and the rules after it', () => {
        const css = '.a::before { content: "@import \'x\'"; }\n.b { color: red; }';

        expect(normalizeCssOverrides(css)).toBe(css);
    });
});
