import { flushPromises } from '@vue/test-utils';
import { defineCustomElement, ref } from 'vue';
import BillingInformationFormEntry from './BillingInformationForm.entry.vue';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

/**
 * DD-3548 round 3 (tester): a refused save is reported once as REQUEST_FAILED, and the customer
 * sees why. The real entry in a real custom element, with only `fetch` stubbed.
 */

// The entry imports `EntryProvider` from the barrel, which `vitest.setup.ts` mocks.
vi.unmock('@/components/providers');

vi.mock('@/components/providers/AuthProvider/AuthProvider.lib', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAuth: () => ({ accessToken: ref('access-token') }),
}));

const customer = {
    id: 'cus_123',
    object_type: 'CUSTOMER',
    email: 'billing@example.com',
    type: 'INDIVIDUAL',
    individual: {
        name: { first_name: 'John', last_name: 'Doe' },
        residential_address: {
            line1: 'Main street 1',
            postal_code: '1000AA',
            city: 'Amsterdam',
            country: 'NL',
        },
    },
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_1' },
    });

const settle = async () => {
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();
};

let tagCount = 0;

const submitRefused = async (refusal: Record<string, unknown>) => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method ?? 'GET';
            if (url.includes('/portal/portal-urls/')) return json(200, createTestPortalObject());
            if (url.includes('/portal/customers/') && method === 'GET') return json(200, customer);
            if (url.includes('/portal/customers/')) return json(422, refusal);
            return json(404, {});
        }),
    );
    const tag = `solvimon-tester-r3-bif-${++tagCount}`;
    customElements.define(tag, defineCustomElement(BillingInformationFormEntry));
    const element = document.createElement(tag);
    const errorEvents: Event[] = [];
    element.addEventListener('error', (event) => errorEvents.push(event));
    const onLog = vi.fn();
    Object.assign(element, {
        environment: 'TEST',
        portalObject: createTestPortalObject(),
        onLog,
    });
    document.body.append(element);
    await settle();

    element.shadowRoot
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    return {
        codes: onLog.mock.calls.map(([entry]) => (entry as LogEntry).code),
        errorEvents,
        text: element.shadowRoot?.textContent ?? '',
    };
};

describe('billing-information-form, a refused save (tester)', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('is reported once as REQUEST_FAILED, never as unhandled', async () => {
        const { codes, errorEvents } = await submitRefused({ message: 'Refused' });

        expect(codes.filter((code) => code === 'REQUEST_FAILED')).toHaveLength(1);
        expect(codes).not.toContain('UNHANDLED_ERROR');
        expect(errorEvents).toEqual([]);
    });

    // DEFECT (also on main): `BillingInformationForm.entry.view.vue:22` passes the `update.error`
    // Ref itself to `getApiError`, which finds neither `field` nor `message` on a Ref, so
    // `apiError` is always undefined and nothing is shown.
    it.fails('shows a refusal without a field as a notification', async () => {
        const { text } = await submitRefused({ message: 'Refused by the API' });

        expect(text).toContain('Refused by the API');
    });

    it.fails('shows a refusal naming a field against that field', async () => {
        const { text } = await submitRefused({
            message: 'Not a street we know',
            field: 'address_line_1',
        });

        expect(text).toContain('Not a street we know');
    });
});
