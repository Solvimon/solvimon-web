import type { CssOverridesProviderProps } from './CssOverridesProvider.types';

const isImportRule = (rule: CSSRule) =>
    typeof CSSImportRule === 'function' && rule instanceof CSSImportRule;

/**
 * The rules a browser reads from `css`, parsed in a document with no browsing context, which keeps
 * its `@import` rules as rules but never loads them. Where that yields no sheet, a constructed one
 * does the parsing instead; it drops `@import` rules itself, so it cannot say whether there were any.
 */
function parseRules(css: string): { rules: CSSRule[]; hasImports: boolean } | undefined {
    if (typeof document === 'undefined') return undefined;

    const inert = document.implementation.createHTMLDocument('');
    const style = inert.createElement('style');
    style.textContent = css;
    inert.head.append(style);

    if (style.sheet) {
        const rules = [...style.sheet.cssRules];
        return { rules, hasImports: rules.some(isImportRule) };
    }

    if (typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        return { rules: [...sheet.cssRules], hasImports: true };
    }

    return undefined;
}

/**
 * `css` without the `@import` rules a browser would find in it. A constructed stylesheet ignores
 * them while the `<style>` fallback loads them, so the same overrides would style an element
 * differently from one browser to the next. The browser's own parser decides what is an import —
 * escapes, comments and strings included — and the text is rewritten only when there may be one,
 * from the rules it kept and in their order.
 */
export function removeImportRules(css: string): string {
    if (!css.includes('@')) return css;

    const parsed = parseRules(css);
    if (!parsed?.hasImports) return css;

    return parsed.rules
        .filter((rule) => !isImportRule(rule))
        .map((rule) => rule.cssText)
        .join('\n');
}

/** The overrides as one block of CSS, without `@import` rules. */
export function normalizeCssOverrides(
    cssOverrides: CssOverridesProviderProps['cssOverrides'],
): string {
    if (!cssOverrides) return '';

    const css = Array.isArray(cssOverrides)
        ? cssOverrides.filter(Boolean).join('\n')
        : cssOverrides;

    return removeImportRules(css.trim());
}
