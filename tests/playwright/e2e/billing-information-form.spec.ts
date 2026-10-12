import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    billingInformationForm,
    mountBillingInformationForm,
} from '../support/billingInformationForm';
import { aCustomer, type Json } from '../support/fixtures';

/**
 * The billing information form (DD-3541), end to end against the built SDK and a mocked API.
 */

const anOrganization = (taxIds: Json[], country = 'NL'): Json => {
    const customer = aCustomer({ type: 'ORGANIZATION', name: 'Acme B.V.', country });
    const organization = Reflect.get(customer, 'organization') as Record<string, unknown>;
    const address = organization.registered_address as Record<string, unknown>;

    return {
        ...customer,
        organization: {
            ...organization,
            tax_ids: taxIds,
            registered_address: { ...address, state: 'ON', postal_code: '12345' },
        },
    };
};

const echo =
    (base: Json) =>
    (request: { postDataJSON: () => unknown }): { body: Json } => ({
        body: { ...base, ...(request.postDataJSON() as Json) },
    });

async function selectCountry(page: Page, country: string) {
    const input = billingInformationForm(page).root.getByRole('textbox', {
        name: 'Billing country',
    });
    await input.click();
    await input.fill(country);
    await page.getByRole('option', { name: country, exact: true }).first().click();
}

test.describe('Billing information form', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('saves an edit, shows what the API saved and turns Save off again', async ({ page }) => {
        const customer = aCustomer();
        api = await mountBillingInformationForm(page, {
            customer,
            mocks: { updateCustomer: { body: { ...customer, email: 'normalised@example.com' } } },
        });
        const form = billingInformationForm(page);

        await expect(form.email).toHaveValue('ada@example.com');
        await expect(form.save).toBeDisabled();

        await form.email.fill('Normalised@Example.com');
        await expect(form.save).toBeEnabled();
        await form.save.click();

        await api.waitForCall('updateCustomer');
        expect(api.lastCall('updateCustomer')!.body).toMatchObject({
            email: 'Normalised@Example.com',
        });
        await expect(form.email).toHaveValue('normalised@example.com');
        await expect(form.save).toBeDisabled();
    });

    test('does not send an invalid email address', async ({ page }) => {
        api = await mountBillingInformationForm(page, { customer: aCustomer() });
        const form = billingInformationForm(page);

        await form.email.fill('foo');
        await form.save.click();

        await expect(form.root).toContainText('not a valid email');
        expect(api.calls('updateCustomer')).toHaveLength(0);
    });

    test('sends one PATCH for a double click', async ({ page }) => {
        const customer = aCustomer();
        api = await mountBillingInformationForm(page, {
            customer,
            mocks: { updateCustomer: { body: customer, delayMs: 500 } },
        });
        const form = billingInformationForm(page);

        await form.email.fill('edited@example.com');
        await form.save.dblclick();

        await api.waitForCall('updateCustomer');
        await expect(form.save).toBeDisabled();
        expect(api.calls('updateCustomer')).toHaveLength(1);
    });

    test('shows a field error from the API next to the VAT number', async ({ page }) => {
        api = await mountBillingInformationForm(page, {
            customer: anOrganization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            mocks: {
                updateCustomer: {
                    status: 400,
                    body: {
                        type: 'VALIDATION_ERROR',
                        code: 'INVALID_FIELD',
                        field: 'organization.tax_ids[0].id',
                        message: 'This tax id does not exist',
                    },
                },
            },
        });
        const form = billingInformationForm(page);

        await form.vatNumber.fill('DE123456789');
        await form.save.click();

        await expect(form.root).toContainText('This tax id does not exist');
        await expect(form.root.getByRole('alert')).toHaveCount(0);
    });

    test('shows a server error as a generic error', async ({ page }) => {
        api = await mountBillingInformationForm(page, {
            customer: aCustomer(),
            mocks: {
                updateCustomer: {
                    status: 500,
                    body: { type: 'SERVER_ERROR', code: 'INTERNAL', message: 'Internal error' },
                },
            },
        });
        const form = billingInformationForm(page);

        await form.email.fill('edited@example.com');
        await form.save.click();

        await expect(form.root).toContainText('Internal error');
        await expect(form.save).toBeEnabled();
    });

    test('sends an emptied VAT number as no tax ids', async ({ page }) => {
        const customer = anOrganization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]);
        api = await mountBillingInformationForm(page, {
            customer,
            mocks: { updateCustomer: echo(customer) },
        });
        const form = billingInformationForm(page);

        await expect(form.vatNumber).toHaveValue('NL123456789B01');
        await form.vatNumber.fill('');
        await form.save.click();

        await api.waitForCall('updateCustomer');
        expect(api.lastCall('updateCustomer')!.body).toMatchObject({
            organization: { tax_ids: [] },
        });
        await expect(form.vatNumber).toHaveValue('');
        await expect(form.save).toBeDisabled();
    });

    test('does not send a legal name that is empty or VAT number NL123', async ({ page }) => {
        api = await mountBillingInformationForm(page, {
            customer: anOrganization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
        });
        const form = billingInformationForm(page);

        await form.legalName.fill('');
        await form.save.click();
        await form.legalName.fill('Acme B.V.');
        await form.vatNumber.fill('NL123');
        await form.save.click();

        await expect(form.root).toContainText('Invalid tax ID format');
        expect(api.calls('updateCustomer')).toHaveLength(0);
    });

    test('asks for a state after switching to Canada', async ({ page }) => {
        const customer = aCustomer();
        api = await mountBillingInformationForm(page, {
            customer,
            mocks: { updateCustomer: echo(customer) },
        });
        const form = billingInformationForm(page);

        await selectCountry(page, 'Canada');
        await form.save.click();
        expect(api.calls('updateCustomer')).toHaveLength(0);

        await form.root.locator('input[name="state"]').fill('ON');
        await form.save.click();

        await api.waitForCall('updateCustomer');
        expect(api.lastCall('updateCustomer')!.body).toMatchObject({
            individual: { residential_address: { country: 'CA', state: 'ON' } },
        });
    });

    test('asks for line 1 and a postal code after switching to the US', async ({ page }) => {
        api = await mountBillingInformationForm(page, { customer: aCustomer() });
        const form = billingInformationForm(page);

        await form.root.locator('input[name="address_line_1"]').fill('');
        await form.root.locator('input[name="postal_code"]').fill('');
        await selectCountry(page, 'United States');
        await form.save.click();

        await expect(form.save).toBeEnabled();
        expect(api.calls('updateCustomer')).toHaveLength(0);
    });

    // DEFECT: the `taxId` rule only knows European formats, so a stored Canadian GST/HST number
    // (a type the API offers) blocks every save, even of an unrelated field.
    test.fail(
        'saves an email change for a customer with a stored Canadian tax id',
        async ({ page }) => {
            const customer = anOrganization([{ id: '123456789RT0001', type: 'CA_GST_HST' }], 'CA');
            api = await mountBillingInformationForm(page, {
                customer,
                mocks: { updateCustomer: echo(customer) },
            });
            const form = billingInformationForm(page);

            await form.email.fill('edited@example.com');
            await form.save.click();

            await expect.poll(() => api.calls('updateCustomer').length, { timeout: 3000 }).toBe(1);
        },
    );
});
