import { createCheckoutSessionsService, toCheckoutSessionPatch } from './checkoutSessions';
import type { CheckoutSessionCustomerPatch } from '@/types/checkoutSession';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { transaction: 'https://transaction.test' } }),
}));

describe('checkout sessions service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue({});
    });

    it('reads the session through its portal URL', async () => {
        await createCheckoutSessionsService().getCheckoutSession('purl_1');

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://transaction.test/portal/portal-urls/purl_1',
        });
    });

    it('patches the session with the body it is given, a 400 being for the caller', async () => {
        const body = toCheckoutSessionPatch(3, { customers: [{ email: 'a@b.test' }] });

        await createCheckoutSessionsService().updateCheckoutSession('purl_1', body);

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://transaction.test/portal/portal-urls/purl_1',
            data: body,
            options: { method: 'PATCH', expectedStatusCodes: [400] },
        });
    });

    it('previews the session with a bodiless POST', async () => {
        await createCheckoutSessionsService().previewCheckoutSession('purl_1');

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://transaction.test/portal/portal-urls/purl_1/preview',
            options: { method: 'POST' },
        });
    });

    it('keeps an id from adding a path segment of its own', async () => {
        await createCheckoutSessionsService().getCheckoutSession('purl_1/preview');

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://transaction.test/portal/portal-urls/purl_1%2Fpreview',
        });
    });
});

describe('toCheckoutSessionPatch', () => {
    it('sends the version it read and nothing else when nothing changed', () => {
        expect(toCheckoutSessionPatch(4, {})).toStrictEqual({
            checkout_session: { expected_version: 4 },
        });
    });

    it('sends an untouched entry before an edited one as {}, and leaves trailing ones off', () => {
        const body = toCheckoutSessionPatch(1, {
            customers: [undefined, { email: 'b@c.test' }, undefined],
            pricing_plan_subscriptions: [
                undefined,
                [{ pricing_plan_schedule_id: 'pps_2', seats_values: [] }],
                undefined,
            ],
        });

        expect(body.checkout_session.customers).toStrictEqual([
            {},
            { customer: { email: 'b@c.test' } },
        ]);
        expect(body.checkout_session.pricing_plan_subscriptions).toStrictEqual([
            {},
            {
                pricing_plan_schedule_customizations: [
                    { pricing_plan_schedule_id: 'pps_2', seats_values: [] },
                ],
            },
        ]);
    });

    it('sends only the customer keys a buyer may change, at every level', () => {
        const customer = {
            reference: 'cust-ref',
            type: 'ORGANIZATION',
            locale: 'nl-NL',
            timezone: 'Europe/Amsterdam',
            roles: ['BILLING'],
            object_type: 'CUSTOMER',
            id: 'cus_1',
            email: 'a@b.test',
            individual: {
                name: { first_name: 'Ada', middle_name: 'B' },
                residential_address: { city: 'Utrecht', country: 'NL', district: 'Oost' },
                date_of_birth: '1990-01-01',
            },
            organization: {
                legal_name: 'Acme',
                status: 'ACTIVE',
                registered_address: { line1: 'Main 1', country: 'NL', id: 'addr_1' },
                tax_ids: [
                    {
                        id: 'NL1',
                        type: 'EU_VAT',
                        tax_id_validation_result: { valid: 'VALID' },
                    },
                ],
            },
        } as unknown as CheckoutSessionCustomerPatch;

        const body = toCheckoutSessionPatch(1, {
            customers: [customer],
            pricing_plan_subscriptions: [
                [
                    {
                        pricing_plan_schedule_id: 'pps_1',
                        promotion_codes: ['SPRING'],
                        coupons: ['coupon_1'],
                    } as never,
                ],
            ],
        });

        expect(body.checkout_session.customers).toStrictEqual([
            {
                customer: {
                    email: 'a@b.test',
                    individual: {
                        name: { first_name: 'Ada' },
                        residential_address: { city: 'Utrecht', country: 'NL' },
                    },
                    organization: {
                        legal_name: 'Acme',
                        registered_address: { line1: 'Main 1', country: 'NL' },
                        tax_ids: [{ id: 'NL1', type: 'EU_VAT' }],
                    },
                },
            },
        ]);
        expect(body.checkout_session.pricing_plan_subscriptions).toStrictEqual([
            {
                pricing_plan_schedule_customizations: [
                    { pricing_plan_schedule_id: 'pps_1', promotion_codes: ['SPRING'] },
                ],
            },
        ]);
    });

    it('keeps null only on the lists it clears', () => {
        const body = toCheckoutSessionPatch(1, {
            customers: [
                {
                    email: null,
                    custom_fields: null,
                    organization: {
                        legal_name: null,
                        tax_ids: null,
                        tax_registrations: null,
                        registered_address: undefined,
                    },
                } as unknown as CheckoutSessionCustomerPatch,
            ],
            pricing_plan_subscriptions: [
                [{ pricing_plan_schedule_id: 'pps_1', promotion_codes: null }],
            ],
        });

        expect(body.checkout_session.customers).toStrictEqual([
            {
                customer: {
                    custom_fields: null,
                    organization: { tax_ids: null, tax_registrations: null },
                },
            },
        ]);
        expect(body.checkout_session.pricing_plan_subscriptions).toStrictEqual([
            {
                pricing_plan_schedule_customizations: [
                    { pricing_plan_schedule_id: 'pps_1', promotion_codes: null },
                ],
            },
        ]);
    });

    it('treats a customer left with no allowed key as untouched', () => {
        const body = toCheckoutSessionPatch(1, {
            customers: [{ id: 'cus_1' } as unknown as CheckoutSessionCustomerPatch],
        });

        expect(body.checkout_session.customers).toBeUndefined();
    });
});
