import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { mountSubscriptionDetails, subscriptionDetails } from '../support/subscriptionDetails';

/**
 * `@import` in `cssOverrides`, checked in a browser because only a browser's CSS parser can say
 * what it would load: jsdom parses none of this. Every import names a host the API mock does not
 * answer, so one the browser tried to load shows up as an unmatched call.
 */

const TAG = 'solvimon-subscription-details';

const IMPORT_SPELLINGS: [string, string][] = [
    ['plainly', '@import "https://fonts.example.com/plain.css";'],
    ['with no whitespace before the string', '@import"https://fonts.example.com/nospace.css";'],
    ['with a comment instead of whitespace', '@import/**/"https://fonts.example.com/comment.css";'],
    ['with an escaped at-keyword', '@\\69mport "https://fonts.example.com/escaped.css";'],
    [
        'with an escaped at-keyword and its terminating space',
        '@\\69 mport "https://fonts.example.com/escaped-space.css";',
    ],
    ['split over lines', '@import\nurl(https://fonts.example.com/lines.css);'],
    ['with a media query', "@import 'https://fonts.example.com/media.css' screen;"],
    [
        'in capitals, with a layer and a condition',
        '@IMPORT url("https://fonts.example.com/layer.css") layer(base) supports(display: grid) print;',
    ],
    [
        'with a data URL',
        '@import url("data:text/css;base64,LnN2LXJvb3QgeyBjb2xvcjogYmx1ZTsgfQ==");',
    ],
];

interface OverrideSheet {
    importRules: number;
    rules: string[];
}

/** Sets the overrides and reads back the sheet the element made of them, however it holds it. */
async function applyOverrides(page: Page, css: string): Promise<OverrideSheet> {
    await page.evaluate(
        ({ tag, css }) => Object.assign(document.querySelector(tag) ?? {}, { cssOverrides: css }),
        { tag: TAG, css },
    );

    return page.evaluate((tag) => {
        const root = document.querySelector(tag)?.shadowRoot;
        const style = root?.querySelector<HTMLStyleElement>('style[data-solvimon-css-overrides]');
        const sheet = style ? style.sheet : root?.adoptedStyleSheets.at(-1);
        const rules = [...(sheet?.cssRules ?? [])];

        return {
            importRules: rules.filter((rule) => rule instanceof CSSImportRule).length,
            rules: rules.map((rule) => rule.cssText),
        };
    }, TAG);
}

const rootColor = (page: Page) =>
    page.evaluate((tag) => {
        const root = document.querySelector(tag)?.shadowRoot?.querySelector('.sv-root');
        return root ? getComputedStyle(root).color : undefined;
    }, TAG);

for (const [path, withoutAdoption] of [
    ['an adopted stylesheet', false],
    ['the <style> fallback', true],
] as const) {
    test.describe(`cssOverrides through ${path}`, () => {
        let api: ApiMock;

        test.beforeEach(async ({ page }) => {
            if (withoutAdoption) {
                // What a browser without constructed stylesheets looks like to the SDK.
                await page.addInitScript(() => {
                    Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets');
                });
            }

            api = await mountSubscriptionDetails(page);
            await expect(subscriptionDetails(page).title).toBeVisible();
        });

        test.afterEach(() => {
            expect(api.unmatchedCalls().map(({ url }) => url)).toEqual([]);
        });

        for (const [description, rule] of IMPORT_SPELLINGS) {
            test(`drops an @import written ${description} and keeps the rules after it`, async ({
                page,
            }) => {
                const sheet = await applyOverrides(
                    page,
                    `${rule}\n.sv-root { color: rgb(255, 0, 0); }`,
                );

                expect(sheet.importRules).toBe(0);
                expect(sheet.rules).toEqual(['.sv-root { color: rgb(255, 0, 0); }']);
                await expect.poll(() => rootColor(page)).toBe('rgb(255, 0, 0)');
            });
        }

        test('leaves alone a rule that only mentions @import, and the rules after it', async ({
            page,
        }) => {
            const sheet = await applyOverrides(
                page,
                '.a::before { content: "@import \'x\'"; }\n.sv-root { color: rgb(0, 128, 0); }',
            );

            expect(sheet.rules).toEqual([
                '.a::before { content: "@import \'x\'"; }',
                '.sv-root { color: rgb(0, 128, 0); }',
            ]);
            await expect.poll(() => rootColor(page)).toBe('rgb(0, 128, 0)');
        });

        test('loads nothing for an @import the browser would not read as one', async ({ page }) => {
            const sheet = await applyOverrides(
                page,
                '@im@import "https://fonts.example.com/nested.css";port "x.css";\n.b { color: red; }',
            );

            expect(sheet.importRules).toBe(0);
        });
    });
}
