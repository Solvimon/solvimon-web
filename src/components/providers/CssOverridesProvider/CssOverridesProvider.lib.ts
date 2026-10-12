import type { CssOverridesProviderProps } from './CssOverridesProvider.types';

/** The URL is matched as a whole first, so a `;` inside one — a data URL's — does not end the rule. */
const IMPORT_RULE = /@import\s+(?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*')[^;]*;?/gi;

/**
 * The overrides as one block of CSS, without `@import` rules. A constructed stylesheet ignores
 * them while the `<style>` fallback loads them, so the same overrides would style an element
 * differently from browser to browser; dropping them in both keeps the two alike.
 */
export function normalizeCssOverrides(
    cssOverrides: CssOverridesProviderProps['cssOverrides'],
): string {
    if (!cssOverrides) return '';

    const css = Array.isArray(cssOverrides)
        ? cssOverrides.filter(Boolean).join('\n')
        : cssOverrides;

    return css.replace(IMPORT_RULE, '').trim();
}
