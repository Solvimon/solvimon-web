/**
 * Helpers for deciding whether the stylesheet vite extracts from the library build carries
 * anything the bundle does not already contain.
 *
 * Every SDK component renders inside a shadow root, and a shadow root is not reached by a
 * stylesheet on the host page. Styles therefore travel as strings that are adopted into each root
 * — `componentStyles` and the inlined tailwind build in `src/utils/customElements.ts`. The
 * `.css` file vite writes alongside them is the discarded half of a double import: the Solvimon UI
 * components import their styles both as a side effect (extracted here) and as a string (inlined,
 * and the copy that actually applies).
 *
 * Deleting the file is only safe while that stays true, which is what these check.
 */

/**
 * Strips everything that differs between the two copies without any rule differing: the asset is
 * minified while the embedded strings are not, so escaped newlines, whitespace and quote style all
 * vary on their own.
 *
 * @param {string} source
 * @returns {string}
 */
export function normalizeCss(source) {
    return source
        .replace(/\\[nrt]/g, '')
        .replace(/["']/g, '')
        .replace(/\s+/g, '');
}

/**
 * The first selector of every rule in `css`. One selector per rule is enough to find a rule the
 * bundle has never heard of, and avoids depending on how a minifier reorders a selector list.
 *
 * @param {string} css
 * @returns {string[]}
 */
export function cssRuleSelectors(css) {
    // At-rules such as @media wrap other rules; their blocks are matched by the inner rules.
    return [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
        .map(([, selector]) => selector.split(',')[0].trim())
        .filter((selector) => selector && !selector.startsWith('@'));
}

/**
 * Selectors present in `css` that the JS does not also contain.
 *
 * @param {string} css - the extracted stylesheet
 * @param {string} js - every JS chunk of the same build, concatenated
 * @returns {string[]} empty when the stylesheet is wholly redundant
 */
export function selectorsMissingFrom(css, js) {
    const haystack = normalizeCss(js);
    return cssRuleSelectors(css).filter((selector) => !haystack.includes(normalizeCss(selector)));
}
