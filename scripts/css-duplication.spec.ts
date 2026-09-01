import { describe, it, expect } from 'vitest';
import { normalizeCss, cssRuleSelectors, selectorsMissingFrom } from './css-duplication.mjs';

describe('normalizeCss', () => {
    it('erases the quote and whitespace differences minification introduces', () => {
        expect(normalizeCss("input[type='range'] ")).toBe(normalizeCss('input[type=range]'));
    });

    /**
     * Why `selectorsMissingFrom` compares selectors rather than whole rules: a minifier drops the
     * final semicolon, so two copies of one rule differ in the body even when nothing has changed.
     */
    it('does not make declaration bodies comparable, and is not asked to', () => {
        expect(normalizeCss('{width:100%}')).not.toBe(normalizeCss('{width: 100%;}'));
    });

    it('treats escaped newlines in a JS string like real whitespace', () => {
        expect(normalizeCss('a {\\n  color: red;\\n}')).toBe('a{color:red;}');
    });
});

describe('cssRuleSelectors', () => {
    it('returns the first selector of each rule', () => {
        const css = '.a,.b{color:red}.c{color:blue}';
        expect(cssRuleSelectors(css)).toStrictEqual(['.a', '.c']);
    });

    it('returns nothing for a stylesheet with no rules', () => {
        expect(cssRuleSelectors('')).toStrictEqual([]);
    });
});

describe('selectorsMissingFrom', () => {
    /** How the UI package ships a style twice: minified in the asset, verbatim in a JS string. */
    const js = String.raw`const s = "input[type='range'] {\n    width: 100%;\n}\n.card {\n    gap: 4px;\n}";`;

    it('finds nothing when every rule is also embedded in the JS', () => {
        expect(
            selectorsMissingFrom('input[type=range]{width:100%}.card{gap:4px}', js),
        ).toStrictEqual([]);
    });

    it('is not fooled by quote style or whitespace differing between the copies', () => {
        expect(selectorsMissingFrom("input[type='range']{width:100%}", js)).toStrictEqual([]);
    });

    it('reports a rule that exists only in the stylesheet', () => {
        expect(selectorsMissingFrom('.orphan{color:red}', js)).toStrictEqual(['.orphan']);
    });

    it('reports only the rules that are missing, not the whole stylesheet', () => {
        expect(selectorsMissingFrom('.card{gap:4px}.orphan{color:red}', js)).toStrictEqual([
            '.orphan',
        ]);
    });

    it('treats an empty stylesheet as fully redundant', () => {
        expect(selectorsMissingFrom('', js)).toStrictEqual([]);
    });
});
