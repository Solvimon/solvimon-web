import { test, expect, type Page } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, mountCheckout, type MountOptions } from '../support/checkout';
import { anInvoicePreview, aSubscription, aSuccessfulAuthorization } from '../support/fixtures';

/**
 * DD-3542 tester, round 2: the legal name, the address fields named without Input's label row, and
 * the race between a price change and the pay button.
 */

async function loaded(page: Page) {
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
}

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        ...options,
    });
    await loaded(page);
    return api;
}

async function selectCountry(page: Page, country: string) {
    await checkout(page).country.click();
    await checkout(page).country.fill(country);
    await page.getByRole('option', { name: country, exact: true }).first().click();
}

async function forceLocale(page: Page, locale: string) {
    await page.addInitScript((forced: string) => {
        let config: unknown;
        Object.defineProperty(window, '__SOLVIMON_TEST_CONFIG__', {
            configurable: true,
            get: () => config,
            set: (value: object) => {
                config = { ...value, locale: forced };
            },
        });
    }, locale);
}

const amountOf = (body: unknown): unknown =>
    typeof body === 'object' && body !== null ? Reflect.get(body, 'amount') : undefined;

test.describe('DD-3542 tester r2', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test.describe('legal name', () => {
        test('blocks a company purchase without one, and lets it through once filled', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await checkout(page).companyPurchase.click();
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-legal_name')).toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);

            await checkout(page).legalName.fill('Example B.V.');
            await expect(page.getByTestId('input-legal_name')).not.toContainText(/required/i);
            // The pay button ignores a second click within 500ms.
            await page.waitForTimeout(600);
            await checkout(page).submit.click();
            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(authorization.body)).toContain('"legal_name":"Example B.V."');
        });

        test('re-validates when switching between company and individual', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await checkout(page).companyPurchase.click();
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-legal_name')).toContainText(/required/i);

            // Individual: no legal name asked, nothing in the way.
            await checkout(page).companyPurchase.click();
            await expect(checkout(page).legalName).toBeHidden();
            await page.waitForTimeout(600);
            // Company again, still empty: blocked again.
            await checkout(page).companyPurchase.click();
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-legal_name')).toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);

            await checkout(page).companyPurchase.click();
            await page.waitForTimeout(600);
            await checkout(page).submit.click();
            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(authorization.body)).toContain('"type":"INDIVIDUAL"');
        });

        test('does not count a blank legal name as one', async ({ page }) => {
            api = await mountLoaded(page);

            await checkout(page).companyPurchase.click();
            await checkout(page).legalName.fill('   ');
            await checkout(page).submit.click();

            await expect(page.getByTestId('input-legal_name')).toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });
    });

    test.describe('address fields', () => {
        test('keeps postal code, city and state on one row with errors showing', async ({
            page,
        }, testInfo) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'Canada');
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-state')).toContainText(/required/i);
            await selectCountry(page, 'United States');
            // The state is not required in the US, so its error goes.
            await expect(page.getByTestId('input-state')).not.toContainText(/required/i);
            await page.waitForTimeout(600);
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-postal_code')).toContainText(/required/i);

            await checkout(page).form.screenshot({ path: testInfo.outputPath('r2-errors.png') });

            const postal = await checkout(page).postalCode.boundingBox();
            const city = await checkout(page).city.boundingBox();
            const state = await checkout(page).state.boundingBox();
            expect(Math.abs((postal?.y ?? 0) - (city?.y ?? 0))).toBeLessThan(2);
            expect(Math.abs((city?.y ?? 0) - (state?.y ?? 0))).toBeLessThan(2);
            expect(Math.abs((postal?.height ?? 0) - (city?.height ?? 0))).toBeLessThan(2);
        });

        test('moves focus through the address fields in order with the keyboard', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await checkout(page).addressLine1.focus();
            for (const name of ['address_line_2', 'postal_code', 'city', 'state']) {
                await page.keyboard.press('Tab');
                await expect(page.locator(`input[name="${name}"]`)).toBeFocused();
            }
        });

        test('focuses the field when its label is clicked', async ({ page }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            for (const [name, label] of [
                ['address_line_2', 'Address line 2'],
                ['postal_code', 'Postal code'],
                ['city', 'City'],
                ['state', 'State'],
            ]) {
                await checkout(page)
                    .form.locator('label', { hasText: new RegExp(`^${label}$`) })
                    .dispatchEvent('click');
                await expect(page.locator(`input[name="${name}"]`)).toBeFocused();
            }
        });

        for (const [locale, postal] of [
            ['en-US', 'Postal code'],
            ['nl-NL', 'Postcode'],
            ['de-DE', 'Postleitzahl'],
            ['it-IT', 'Codice postale'],
        ]) {
            test(`names the postal code exactly "${postal}" in ${locale}`, async ({ page }) => {
                await forceLocale(page, locale);
                api = await mountCheckout(page, {
                    configuration: { email: 'customer@example.com', countryCode: 'US' },
                });

                await expect(
                    page.getByRole('textbox', { name: postal, exact: true }),
                ).toHaveAttribute('name', 'postal_code');
            });
        }

        test('ties the postal code error to its field for assistive technology', async ({
            page,
        }) => {
            // Defect: the error renders below the field, but nothing points the input at it, so a
            // screen reader does not announce it with the field.
            test.fail();
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-postal_code')).toContainText(/required/i);

            await expect(checkout(page).postalCode).toHaveAccessibleDescription(/required/i);
        });

        test('leaves address line 1 as it was', async ({ page }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await expect(page.getByRole('textbox', { name: /Billing address/ })).toHaveAttribute(
                'name',
                'address_line_1',
            );
        });
    });

    test.describe('a price change raced by the pay button', () => {
        const byCountry = (request: { postDataJSON: () => unknown }): MockResponse => {
            const total = JSON.stringify(request.postDataJSON()).includes('"country":"US"')
                ? '20.00'
                : '24.20';
            return { body: anInvoicePreview({ total }) };
        };

        // Defect, also on main (worse there): Pay is held only while a preview is in flight, not
        // during the 200ms debounce before it is asked for, so the payment carries the old price.
        test('pays the price of the country chosen, not of the one before (US to DE)', async ({
            page,
        }) => {
            test.fail();
            api = await mountLoaded(page, {
                mocks: {
                    invoicePreview: byCountry,
                    authorizePayment: { body: aSuccessfulAuthorization() },
                },
            });
            await expect(checkout(page).orderSummary).toContainText('24.20');

            await selectCountry(page, 'United States');
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).postalCode.fill('10001');
            await expect(checkout(page).orderSummary).toContainText('20.00');
            await expect(checkout(page).orderSummary).not.toContainText('24.20');
            await page.waitForTimeout(600);

            // Germany, and pay straight away: well within the 200ms before its preview is asked.
            await selectCountry(page, 'Germany');
            await checkout(page).submit.dispatchEvent('click');

            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(authorization.body)).toContain('"country":"DE"');
            expect(amountOf(authorization.body)).toMatchObject({ quantity: '24.20' });
        });

        test('pays the price of the seats chosen, not of the ones before', async ({ page }) => {
            test.fail();
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    seats: [
                        { pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' },
                    ],
                }),
                mocks: {
                    invoicePreview: (request) => {
                        const body = JSON.stringify(request.postDataJSON());
                        return {
                            body: anInvoicePreview({
                                total: body.includes('"number":"5"') ? '50.00' : '20.00',
                            }),
                        };
                    },
                    authorizePayment: { body: aSuccessfulAuthorization() },
                },
            });

            await checkout(page).seats.fill('5');
            await checkout(page).submit.click();

            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(authorization.body)).toContain('"number":"5"');
            expect(amountOf(authorization.body)).toMatchObject({ quantity: '50.00' });
        });
    });
});
