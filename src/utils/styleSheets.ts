/**
 * Sharing one parsed stylesheet between shadow roots, rather than handing every component on the page
 * its own `<style>` element to parse again.
 *
 * Everything here falls back to `<style>`: Safari only gained the `CSSStyleSheet` constructor in 16.4,
 * and jsdom does not implement `adoptedStyleSheets` at all.
 */
export const supportsConstructedStyleSheets = (() => {
    try {
        return (
            typeof ShadowRoot !== 'undefined' &&
            'adoptedStyleSheets' in ShadowRoot.prototype &&
            typeof CSSStyleSheet !== 'undefined' &&
            typeof new CSSStyleSheet().replaceSync === 'function'
        );
    } catch {
        return false;
    }
})();

/** A stylesheet built once, to be adopted by as many shadow roots as ask for it. */
export function createStyleSheet(css: string): CSSStyleSheet {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);

    return sheet;
}

/**
 * Adopting appends, and adopted sheets cascade in the order they were adopted — after any `<style>`
 * in the shadow root. The base sheets are therefore adopted while the element is still being
 * constructed, so that a customer's own CSS, adopted once it renders, still lands after them.
 */
export function adoptStyleSheet(root: ShadowRoot, sheet: CSSStyleSheet): void {
    if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
}

export function releaseStyleSheet(root: ShadowRoot, sheet: CSSStyleSheet): void {
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
}
