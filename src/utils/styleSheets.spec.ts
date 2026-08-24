import {
    adoptStyleSheet,
    releaseStyleSheet,
    supportsConstructedStyleSheets,
} from '@/utils/styleSheets';

/**
 * jsdom implements neither `adoptedStyleSheets` nor the cascade, so these cover the ordering this
 * module is responsible for — which sheet ends up after which — with a stand-in for the shadow root.
 * That order is the whole point: the base sheets are adopted while the custom element is constructed,
 * and a customer's `cssOverrides` are adopted once it renders, so they cascade afterwards and win.
 * That the browser then resolves that order the way we expect is covered by the e2e suite.
 */
const createRoot = () => ({ adoptedStyleSheets: [] }) as unknown as ShadowRoot;

const sheet = (id: string) => ({ id }) as unknown as CSSStyleSheet;

describe('styleSheets', () => {
    // The unit suite runs on jsdom, so it exercises the `<style>` fallback rather than this path.
    it('reports no support for constructed stylesheets under jsdom', () => {
        expect(supportsConstructedStyleSheets).toBe(false);
    });

    describe('adoptStyleSheet', () => {
        it('keeps sheets in the order they were adopted, so later ones cascade last', () => {
            const root = createRoot();
            const base = sheet('base');
            const overrides = sheet('overrides');

            adoptStyleSheet(root, base);
            adoptStyleSheet(root, overrides);

            expect(root.adoptedStyleSheets).toStrictEqual([base, overrides]);
        });

        it('does not adopt the same sheet twice', () => {
            const root = createRoot();
            const base = sheet('base');

            adoptStyleSheet(root, base);
            adoptStyleSheet(root, base);

            expect(root.adoptedStyleSheets).toStrictEqual([base]);
        });

        it('replaces the array rather than mutating it, which is what the setter reacts to', () => {
            const root = createRoot();
            const before = root.adoptedStyleSheets;

            adoptStyleSheet(root, sheet('base'));

            expect(root.adoptedStyleSheets).not.toBe(before);
        });

        it('adopts one shared sheet into every root, rather than a copy each', () => {
            const first = createRoot();
            const second = createRoot();
            const base = sheet('base');

            adoptStyleSheet(first, base);
            adoptStyleSheet(second, base);

            expect(second.adoptedStyleSheets[0]).toBe(first.adoptedStyleSheets[0]);
        });
    });

    describe('releaseStyleSheet', () => {
        it('drops only the released sheet and leaves the rest in order', () => {
            const root = createRoot();
            const base = sheet('base');
            const overrides = sheet('overrides');
            const extra = sheet('extra');

            [base, overrides, extra].forEach((entry) => adoptStyleSheet(root, entry));
            releaseStyleSheet(root, overrides);

            expect(root.adoptedStyleSheets).toStrictEqual([base, extra]);
        });

        it('leaves a root alone when the sheet was never adopted', () => {
            const root = createRoot();
            const base = sheet('base');

            adoptStyleSheet(root, base);
            releaseStyleSheet(root, sheet('never-adopted'));

            expect(root.adoptedStyleSheets).toStrictEqual([base]);
        });
    });
});
