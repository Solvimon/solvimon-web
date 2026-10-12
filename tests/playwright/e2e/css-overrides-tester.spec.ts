import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountSubscriptionDetails,
    subscriptionDetails,
} from '../support/subscriptionDetails';
import { aCustomerPortalObject } from '../support/fixtures';

/**
 * Independent checks of DD-3549 round 2: the browser-parsed `@import` removal, on both the adopted
 * and the `<style>` path, and the portal check running before the token exchange. Every URL names
 * a host the API mock does not answer, so anything the browser fetched shows up as unmatched.
 */

const TAG = 'solvimon-subscription-details';
const X = 'https://evil.example';

const NOT_IMPORTS: [string, string][] = [
    ['inside @media', `@media screen { @import "${X}/media.css"; }`],
    ['inside @supports', `@supports (display: grid) { @import "${X}/supports.css"; }`],
    ['inside a @layer block', `@layer x { @import "${X}/layer.css"; }`],
    ['after another rule', `.a { color: blue; } @import "${X}/after.css";`],
    ['after @namespace', `@namespace svg url(http://www.w3.org/2000/svg); @import "${X}/ns.css";`],
];

const IMPORTS: [string, string][] = [
    ['after @charset', `@charset "utf-8"; @import "${X}/charset.css";`],
    ['after a @layer statement', `@layer base; @import "${X}/layer-statement.css";`],
    ['with an escaped capital at-keyword', `@\\49MPORT "${X}/upper.css";`],
    ['twice, followed by malformed rules', `@import "${X}/a.css"; @import "${X}/b.css";`],
];

async function setOverrides(page: Page, css: string): Promise<{ imports: number; text: string }> {
    await page.evaluate(
        ({ tag, css }) => Object.assign(document.querySelector(tag) ?? {}, { cssOverrides: css }),
        { tag: TAG, css },
    );

    return page.evaluate((tag) => {
        const root = document.querySelector(tag)?.shadowRoot;
        const style = root?.querySelector<HTMLStyleElement>('style[data-solvimon-css-overrides]');
        const sheet = style ? style.sheet : root?.adoptedStyleSheets?.at(-1);
        const rules = [...(sheet?.cssRules ?? [])];

        return {
            imports: rules.filter((rule) => rule instanceof CSSImportRule).length,
            text: rules.map((rule) => rule.cssText).join('\n'),
        };
    }, TAG);
}

const rootStyle = (page: Page, property: string) =>
    page.evaluate(
        ({ tag, property }) => {
            const root = document.querySelector(tag)?.shadowRoot?.querySelector('.sv-root');
            return root ? getComputedStyle(root).getPropertyValue(property).trim() : undefined;
        },
        { tag: TAG, property },
    );

for (const [path, withoutAdoption] of [
    ['an adopted stylesheet', false],
    ['the <style> fallback', true],
] as const) {
    test.describe(`DD-3549 tester r2: cssOverrides through ${path}`, () => {
        let api: ApiMock;

        test.beforeEach(async ({ page }) => {
            if (withoutAdoption) {
                await page.addInitScript(() => {
                    Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets');
                });
            }

            api = await mountSubscriptionDetails(page);
            await expect(subscriptionDetails(page).title).toBeVisible();
        });

        test.afterEach(async ({ page }) => {
            await page.waitForTimeout(300);
            expect(api.unmatchedCalls().map(({ url }) => url)).toEqual([]);
        });

        for (const [description, css] of NOT_IMPORTS) {
            test(`loads nothing for an @import ${description}`, async ({ page }) => {
                const sheet = await setOverrides(
                    page,
                    `${css}\n.sv-root { color: rgb(255, 0, 0); }`,
                );

                expect(sheet.imports).toBe(0);
                await expect.poll(() => rootStyle(page, 'color')).toBe('rgb(255, 0, 0)');
            });
        }

        for (const [description, css] of IMPORTS) {
            test(`drops an @import ${description}`, async ({ page }) => {
                const sheet = await setOverrides(
                    page,
                    `${css}\n.sv-root { color: rgb(255, 0, 0); } ;;; } } .c { color: blue`,
                );

                expect(sheet.imports).toBe(0);
                await expect.poll(() => rootStyle(page, 'color')).toBe('rgb(255, 0, 0)');
            });
        }

        test('keeps custom properties, !important, @font-face, @keyframes and @layer when it rewrites', async ({
            page,
        }) => {
            const sheet = await setOverrides(
                page,
                [
                    `@import "${X}/rich.css";`,
                    ':host, .sv-root { --dd-brand: rgb(1, 2, 3); }',
                    '.sv-root { color: var(--dd-brand) !important; }',
                    `@font-face { font-family: DdFont; src: url(${X}/font.woff2) format("woff2"); }`,
                    '@keyframes dd-spin { from { opacity: 0 } to { opacity: 1 } }',
                    '@layer dd-a, dd-b;',
                    '@layer dd-b { .sv-root { outline-color: rgb(0, 0, 255); } }',
                    '@layer dd-a { .sv-root { outline-color: rgb(0, 255, 0); } }',
                    `.sv-root .never-matches { background: url(${X}/bg.png); }`,
                ].join('\n'),
            );

            expect(sheet.imports).toBe(0);
            expect(sheet.text).toContain('@font-face');
            expect(sheet.text).toContain('@keyframes dd-spin');
            expect(sheet.text.indexOf('@layer dd-a, dd-b')).toBeLessThan(
                sheet.text.indexOf('@layer dd-b {'),
            );
            await expect.poll(() => rootStyle(page, 'color')).toBe('rgb(1, 2, 3)');
            await expect.poll(() => rootStyle(page, 'outline-color')).toBe('rgb(0, 0, 255)');
        });

        test('loads nothing for an @import whose string never ends', async ({ page }) => {
            const sheet = await setOverrides(page, `@import "${X}/unterminated.css`);

            expect(sheet.imports).toBe(0);
        });

        test('handles a large override without an import, and one with', async ({ page }) => {
            const big = Array.from(
                { length: 20000 },
                (_, i) => `.dd-${i} { margin: ${i}px; }`,
            ).join('\n');

            const without = await setOverrides(page, `${big}\n.sv-root { color: rgb(9, 9, 9); }`);
            await expect.poll(() => rootStyle(page, 'color')).toBe('rgb(9, 9, 9)');
            expect(without.imports).toBe(0);

            const withImport = await setOverrides(
                page,
                `@import "${X}/huge.css";\n${big}\n.sv-root { color: rgb(8, 8, 8); }`,
            );
            expect(withImport.imports).toBe(0);
            await expect.poll(() => rootStyle(page, 'color')).toBe('rgb(8, 8, 8)');
        });
    });
}

test.describe('DD-3549 tester r2: portal check before the token exchange', () => {
    test('a revoked portal on a non-checkout element exchanges no token and loads nothing', async ({
        page,
    }) => {
        const api = await mountSubscriptionDetails(page, {
            portalObject: aCustomerPortalObject({ status: 'REVOKED' }),
        });

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('RESOURCE_REVOKED');
        await page.waitForTimeout(1000);
        expect(api.calls('accessToken')).toEqual([]);
        expect(api.calls('subscription')).toEqual([]);
        expect(api.calls('customer')).toEqual([]);
        await expect(subscriptionDetails(page).screen).toHaveCount(0);
    });

    test('a portal revoked after mount, with the same token, stops the element', async ({
        page,
    }) => {
        const api = await mountSubscriptionDetails(page);
        await expect(subscriptionDetails(page).title).toBeVisible();

        await page.evaluate((tag) => {
            const element = document.querySelector(tag);
            if (!element) throw new Error('missing');
            Reflect.set(element, 'portalObject', {
                ...Object(Reflect.get(element, 'portalObject')),
                status: 'REVOKED',
            });
        }, TAG);

        await expect(subscriptionDetails(page).screen).toHaveCount(0);
        expect(api.calls('accessToken')).toHaveLength(1);
    });
});
