import { normalizeCssOverrides } from './CssOverridesProvider.lib';

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

    it.each([
        ['@import "theme.css";'],
        ["@import 'theme.css' screen;"],
        ['@import url(https://fonts.example.com/inter.css);'],
        ['@IMPORT url("theme.css") layer(base) supports(display: grid) print;'],
        ['@import url("data:text/css;base64,LmEgeyBjb2xvcjogcmVkOyB9");'],
    ])('drops %s and keeps the rules around it', (rule) => {
        expect(normalizeCssOverrides(`${rule}\n.sv-root { color: red; }`)).toBe(
            '.sv-root { color: red; }',
        );
    });

    it('drops an @import from any entry of a list', () => {
        expect(normalizeCssOverrides(['.a { color: red; }', '@import "b.css";'])).toBe(
            '.a { color: red; }',
        );
    });
});
