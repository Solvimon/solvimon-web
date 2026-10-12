import { test, expect, type Page } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, hostEvents, mountCheckout, type MountOptions } from '../support/checkout';
import { aSuccessfulAuthorization } from '../support/fixtures';

/**
 * DD-3542 tester: the checkout form's validation (hidden VAT, postal code, VAT check, host email,
 * address labels), tried from outside.
 */

const VALID_NL_VAT = 'NL000099998B57';

const aTaxCheck = (valid: 'VALID' | 'NOT_VALID' | 'UNKNOWN'): MockResponse => ({
    body: {
        data: [{ validation_date: '2026-10-12T12:00:00.000Z', source: 'VIES', valid, message: '' }],
    },
});

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

/** Mounts the screen in another locale: the harness hard-codes en-US in its init script. */
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

const checkButton = (page: Page) => checkout(page).form.getByRole('button', { name: 'Check' });

async function companyWithVat(page: Page, vat = VALID_NL_VAT) {
    await checkout(page).companyPurchase.click();
    await checkout(page).legalName.fill('Example B.V.');
    await checkout(page).vatNumber.fill(vat);
}

test.describe('DD-3542 tester', () => {
    let api: ApiMock;
    let consoleErrors: string[];
    let pageErrors: string[];

    test.beforeEach(({ page }) => {
        consoleErrors = [];
        pageErrors = [];
        page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));
    });

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test.describe('hidden VAT number', () => {
        test('pays once the country switches to the US with an invalid VAT number typed', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await companyWithVat(page, '123');
            await selectCountry(page, 'United States');
            await expect(checkout(page).vatNumber).toBeHidden();
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).postalCode.fill('10001');
            await checkout(page).submit.click();

            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(authorization.body)).not.toContain('"123"');
        });

        test('checks the VAT number again once it is shown again', async ({ page }) => {
            api = await mountLoaded(page);

            await companyWithVat(page, '123');
            await selectCountry(page, 'United States');
            await expect(checkout(page).vatNumber).toBeHidden();
            await selectCountry(page, 'Germany');
            await expect(checkout(page).vatNumber).toHaveValue('123');
            await checkout(page).submit.click();

            await expect(checkout(page).form).toContainText(/Invalid tax ID/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('checks it again when company purchase is switched back on', async ({ page }) => {
            api = await mountLoaded(page);

            await companyWithVat(page, '123');
            await checkout(page).companyPurchase.click();
            await checkout(page).companyPurchase.click();
            await expect(checkout(page).vatNumber).toHaveValue('123');
            await checkout(page).submit.click();

            await expect(checkout(page).form).toContainText(/Invalid tax ID/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        // Known gap, also on the base: `authorizationContext` sends any well-formed VAT number on an
        // organization, shown or not, so a US company carries a tax id the customer cannot see.
        test('does not send a hidden VAT number for a US company', async ({ page }) => {
            test.fail();
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await companyWithVat(page, VALID_NL_VAT);
            await selectCountry(page, 'United States');
            await expect(checkout(page).vatNumber).toBeHidden();
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).postalCode.fill('10001');
            await checkout(page).submit.click();

            const authorization = await api.waitForCall('authorizePayment');
            const preview = api.lastCall('invoicePreview');
            expect(JSON.stringify(preview?.body)).not.toContain(VALID_NL_VAT);
            expect(JSON.stringify(authorization.body)).not.toContain(VALID_NL_VAT);
        });

        test('does not send a hidden VAT number for an individual', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await companyWithVat(page, VALID_NL_VAT);
            await checkout(page).companyPurchase.click();
            await checkout(page).submit.click();

            const authorization = await api.waitForCall('authorizePayment');
            expect(JSON.stringify(api.lastCall('invoicePreview')?.body)).not.toContain(
                VALID_NL_VAT,
            );
            expect(JSON.stringify(authorization.body)).not.toContain(VALID_NL_VAT);
        });
    });

    test.describe('postal code', () => {
        test('flags a missing postal code, not the filled-in address line', async ({ page }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).submit.click();

            await expect(page.getByTestId('input-postal_code')).toContainText(/required/i);
            await expect(page.getByTestId('input-address_line_1')).not.toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('does not flag a filled-in postal code when the address line is missing', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await checkout(page).postalCode.fill('10001');
            await checkout(page).submit.click();

            await expect(page.getByTestId('input-address_line_1')).toContainText(/required/i);
            await expect(page.getByTestId('input-postal_code')).not.toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('keeps postal code, city and state on one row with an error showing', async ({
            page,
        }, testInfo) => {
            // Defect: the postal code's error now renders in its label row, which pushes its input
            // 16px below city and state.
            test.fail();
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await checkout(page).addressLine1.fill('1 Main St');
            await checkout(page).submit.click();
            await expect(page.getByTestId('input-postal_code')).toContainText(/required/i);

            await checkout(page).form.screenshot({ path: testInfo.outputPath('us-errors.png') });

            const postal = await checkout(page).postalCode.boundingBox();
            const city = await checkout(page).city.boundingBox();
            const state = await checkout(page).state.boundingBox();
            expect(Math.abs((postal?.y ?? 0) - (city?.y ?? 0))).toBeLessThan(2);
            expect(Math.abs((city?.y ?? 0) - (state?.y ?? 0))).toBeLessThan(2);
        });
    });

    test.describe('VAT check', () => {
        test('clears the outcome when the VAT number changes', async ({ page }) => {
            api = await mountLoaded(page, { mocks: { validateTaxId: aTaxCheck('VALID') } });

            await companyWithVat(page);
            await checkButton(page).click();
            await expect(checkout(page).form).toContainText('VAT number is valid.');

            await checkout(page).vatNumber.fill('NL000099998B58');
            await expect(checkout(page).form).not.toContainText('VAT number is valid.');
        });

        test('clears the outcome when the legal name changes', async ({ page }) => {
            api = await mountLoaded(page, { mocks: { validateTaxId: aTaxCheck('VALID') } });

            await companyWithVat(page);
            await checkButton(page).click();
            await expect(checkout(page).form).toContainText('VAT number is valid.');

            await checkout(page).legalName.fill('Other B.V.');
            await expect(checkout(page).form).not.toContainText('VAT number is valid.');
        });

        test('clears the outcome when the country changes', async ({ page }) => {
            api = await mountLoaded(page, { mocks: { validateTaxId: aTaxCheck('VALID') } });

            await companyWithVat(page);
            await checkButton(page).click();
            await expect(checkout(page).form).toContainText('VAT number is valid.');

            await selectCountry(page, 'Germany');
            await expect(checkout(page).form).not.toContainText('VAT number is valid.');
        });

        test('drops a check still on its way when the VAT number changes', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { validateTaxId: { ...aTaxCheck('VALID'), delayMs: 1500 } },
            });

            await companyWithVat(page);
            await checkButton(page).click();
            await api.waitForCall('validateTaxId');
            await checkout(page).vatNumber.fill('NL000099998B58');
            await page.waitForTimeout(2500);

            await expect(checkout(page).form).not.toContainText('VAT number is valid.');
        });

        test('shows the outcome of the check asked last', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    validateTaxId: (request) => {
                        const body = JSON.stringify(request.postDataJSON());
                        return body.includes('Example B.V.')
                            ? { ...aTaxCheck('VALID'), delayMs: 2000 }
                            : aTaxCheck('NOT_VALID');
                    },
                },
            });

            await companyWithVat(page);
            await checkButton(page).click();
            await api.waitForCall('validateTaxId');
            await checkout(page).legalName.fill('Other B.V.');
            // The Check button swallows a second click within 500ms (solvimon-ui usePreventDoubleClick).
            await page.waitForTimeout(600);
            await checkButton(page).click();
            await expect(checkout(page).form).toContainText('VAT number is invalid.');
            await page.waitForTimeout(2500);

            await expect(checkout(page).form).toContainText('VAT number is invalid.');
            await expect(checkout(page).form).not.toContainText('VAT number is valid.');
        });

        test('shows a neutral notice when VIES cannot answer', async ({ page }) => {
            api = await mountLoaded(page, { mocks: { validateTaxId: aTaxCheck('UNKNOWN') } });

            await companyWithVat(page);
            await checkButton(page).click();

            await expect(checkout(page).form).toContainText(
                'The VAT number could not be checked right now.',
            );
            await expect(checkout(page).form).not.toContainText('VAT number is invalid.');
        });

        test('shows a neutral notice, and no uncaught error, when the check fails', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                mocks: { validateTaxId: { status: 500, body: { message: 'boom' } } },
            });

            await companyWithVat(page);
            await checkButton(page).click();

            await expect(checkout(page).form).toContainText(
                'The VAT number could not be checked right now.',
            );
            await expect(checkout(page).form).not.toContainText('VAT number is invalid.');
            expect(pageErrors).toEqual([]);
            expect(consoleErrors.filter((text) => /unhandled|uncaught/i.test(text))).toEqual([]);
            await expect(checkButton(page)).toBeEnabled();
        });

        test('does not block payment on a VAT number VIES calls invalid', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    validateTaxId: aTaxCheck('NOT_VALID'),
                    authorizePayment: { body: aSuccessfulAuthorization() },
                },
            });

            await companyWithVat(page);
            await checkButton(page).click();
            await expect(checkout(page).form).toContainText('VAT number is invalid.');
            await checkout(page).submit.click();

            await api.waitForCall('authorizePayment');
        });

        test('does not block payment while a check is on its way', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    validateTaxId: { ...aTaxCheck('VALID'), delayMs: 5000 },
                    authorizePayment: { body: aSuccessfulAuthorization() },
                },
            });

            await companyWithVat(page);
            await checkButton(page).click();
            await api.waitForCall('validateTaxId');
            await checkout(page).submit.click();

            await api.waitForCall('authorizePayment');
        });
    });

    test.describe('host email', () => {
        test('drops an invalid email and leaves it out of the log', async ({ page }) => {
            api = await mountLoaded(page, {
                configuration: { email: 'not-an-email', countryCode: 'NL' },
            });

            await expect(checkout(page).email).toHaveValue('');
            await expect(checkout(page).email).toBeEnabled();
            const logs = (await hostEvents(page)).logs.filter(
                ({ code }) => code === 'INVALID_EMAIL',
            );
            expect(logs).toHaveLength(1);
            expect(JSON.stringify(logs)).not.toContain('not-an-email');
        });

        test('drops an email the email field would reject, so the customer can correct it', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                configuration: { email: 'jane@exa_mple.com', countryCode: 'NL' },
            });

            await expect(checkout(page).email).toHaveValue('');
            await expect(checkout(page).email).toBeEnabled();
        });

        test('prefills and locks a valid email', async ({ page }) => {
            api = await mountLoaded(page, {
                configuration: { email: "o'brien+billing@example.co.uk", countryCode: 'NL' },
            });

            await expect(checkout(page).email).toHaveValue("o'brien+billing@example.co.uk");
            await expect(checkout(page).email).toBeDisabled();
            expect((await hostEvents(page)).logs.map(({ code }) => code)).not.toContain(
                'INVALID_EMAIL',
            );
        });
    });

    test.describe('address labels', () => {
        const LABELS: Record<
            string,
            { line2: string; postal: string; city: string; state: string }
        > = {
            'en-US': {
                line2: 'Address line 2',
                postal: 'Postal code',
                city: 'City',
                state: 'State',
            },
            'nl-NL': {
                line2: 'Adresregel 2',
                postal: 'Postcode',
                city: 'Stad',
                state: 'Provincie',
            },
            'de-DE': {
                line2: 'Adresszeile 2',
                postal: 'Postleitzahl',
                city: 'Stadt',
                state: 'Bundesland',
            },
            'it-IT': {
                line2: 'Indirizzo riga 2',
                postal: 'Codice postale',
                city: 'Città',
                state: 'Provincia',
            },
        };

        for (const [locale, labels] of Object.entries(LABELS)) {
            test(`names the address fields in ${locale}`, async ({ page }) => {
                await forceLocale(page, locale);
                api = await mountCheckout(page, {
                    configuration: { email: 'customer@example.com', countryCode: 'US' },
                });
                await expect(checkout(page).addressLine1).toBeVisible();

                const names = await Promise.all(
                    [
                        page.locator('input[name="address_line_2"]'),
                        checkout(page).postalCode,
                        checkout(page).city,
                        checkout(page).state,
                    ].map((input) =>
                        input.evaluate((element) =>
                            (
                                (element instanceof HTMLInputElement ? element.labels : null)?.[0]
                                    ?.textContent ?? ''
                            )
                                .replace(/\s+/g, ' ')
                                .trim(),
                        ),
                    ),
                );

                expect(names[0]).toContain(labels.line2);
                expect(names[1]).toContain(labels.postal);
                expect(names[2]).toContain(labels.city);
                expect(names[3]).toContain(labels.state);
                await expect(page.getByRole('textbox', { name: labels.postal })).toBeVisible();
            });
        }

        test('does not put an untranslated "(optional)" in the accessible names', async ({
            page,
        }) => {
            // Defect: solvimon-ui's Label appends a hard-coded English "(optional)" to a label
            // whose input is not `required`, so nl-NL reads "Adresregel 2 (optional)".
            test.fail();
            await forceLocale(page, 'nl-NL');
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'US' },
            });
            await expect(checkout(page).addressLine1).toBeVisible();

            for (const name of ['address_line_2', 'city', 'state']) {
                const label = await page
                    .locator(`input[name="${name}"]`)
                    .evaluate(
                        (element) =>
                            (element instanceof HTMLInputElement ? element.labels : null)?.[0]
                                ?.textContent,
                    );
                expect(label ?? '').not.toContain('optional)');
            }
        });
    });
});
