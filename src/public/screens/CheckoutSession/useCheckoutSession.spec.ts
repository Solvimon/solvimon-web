import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { CHECKOUT_SESSION_EDIT_DEBOUNCE_MS, useCheckoutSession } from './useCheckoutSession';
import { ApiError } from '@/services/apiError';
import type {
    CheckoutSession,
    CheckoutSessionNewCustomer,
    CheckoutSessionPortalUrlResponse,
    CheckoutSessionPreview,
} from '@/types/checkoutSession';
import { providerMockLogger } from '@/test-utils/providerMock';

const { mockGet, mockUpdate, mockPreview, mockGetSubscription } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockUpdate: vi.fn(),
    mockPreview: vi.fn(),
    mockGetSubscription: vi.fn(),
}));

vi.mock('@/services/checkoutSessions', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/checkoutSessions')>()),
    createCheckoutSessionsService: () => ({
        getCheckoutSession: mockGet,
        updateCheckoutSession: mockUpdate,
        previewCheckoutSession: mockPreview,
    }),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({ getSubscription: mockGetSubscription }),
}));

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: () => ({ getGeoLocation: () => Promise.reject(new Error('none')) }),
}));

const PORTAL_URL_ID = 'purl_1';

const createSession = (overrides: Partial<CheckoutSession> = {}): CheckoutSession => ({
    status: 'OPEN',
    payment_status: 'UNPAID',
    version: 1,
    success_url: 'https://shop.test/done?session={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://shop.test/cancel/{CHECKOUT_SESSION_ID}',
    note: 'Read the **terms**.',
    customers: [
        {
            customer: {
                reference: 'cust-ref',
                type: 'ORGANIZATION',
                email: 'billing@acme.test',
                organization: {
                    legal_name: 'Acme',
                    registered_address: { country: 'NL', city: 'Utrecht' },
                },
            },
            effective_display: {
                customer_details: 'EDITABLE',
                address: 'EDITABLE',
                tax_ids: 'EDITABLE',
                email: 'EDITABLE',
                custom_fields: 'HIDDEN',
            },
        },
    ],
    pricing_plan_subscriptions: [
        {
            template_pricing_plan_subscription_id: 'ppsu_template',
            pricing_plan_subscription: { reference: 'sub-ref', customer_reference: 'cust-ref' },
            options: {
                edit_seats: [
                    {
                        pricing_item_config_id: 'pic_seats',
                        min: { number: '2' },
                        max: { number: '10' },
                    },
                ],
                allow_promotion_codes: 'SINGLE',
            },
            starting_values: [
                {
                    pricing_plan_schedule_id: 'pps_1',
                    seats_values: [{ pricing_item_config_id: 'pic_seats', number: '3' }],
                },
            ],
        },
    ],
    ...overrides,
});

const organizationCustomer = (
    organization: NonNullable<CheckoutSessionNewCustomer['organization']>,
    email = 'billing@acme.test',
): CheckoutSession['customers'][number] => ({
    ...createSession().customers[0],
    customer: { reference: 'cust-ref', type: 'ORGANIZATION', email, organization },
});

const portalUrl = (
    session: Partial<CheckoutSession> = {},
    status: CheckoutSessionPortalUrlResponse['status'] = 'PUBLISHED',
): CheckoutSessionPortalUrlResponse => ({
    object_type: 'PORTAL_URL',
    id: PORTAL_URL_ID,
    type: 'CHECKOUT_SESSION',
    status,
    checkout_session: createSession(session),
});

const previewOf = (version: number, missingFields?: string[]): CheckoutSessionPreview => ({
    invoices: [
        {
            customer_reference: 'cust-ref',
            invoice: { id: `inv_${version}` } as never,
            pricing_plan_subscription_references: ['sub-ref'],
        },
    ],
    total: { currency: 'EUR', amount_excl_tax: '100.00', tax: '21.00', amount_incl_tax: '121.00' },
    checkout_session: { version, ...(missingFields && { missing_fields: missingFields }) },
});

const template = {
    id: 'ppsu_template',
    pricing_plan_schedule_infos: [],
} as unknown as PricingPlanSubscriptionExpanded;

function setup() {
    let result!: ReturnType<typeof useCheckoutSession>;
    mount(
        defineComponent({
            setup() {
                result = useCheckoutSession({ portalUrlId: PORTAL_URL_ID });
                return () => h('div');
            },
        }),
    );
    return result;
}

async function loaded() {
    const result = setup();
    await flushPromises();
    return result;
}

const settleEdits = async () => {
    await vi.advanceTimersByTimeAsync(CHECKOUT_SESSION_EDIT_DEBOUNCE_MS + 10);
    await flushPromises();
};

describe('useCheckoutSession', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        mockGet.mockReset().mockResolvedValue(portalUrl());
        mockUpdate.mockReset();
        mockPreview.mockReset().mockResolvedValue(previewOf(1));
        mockGetSubscription.mockReset().mockResolvedValue(template);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('on load', () => {
        it('reads the session and previews it at the same time', async () => {
            mockGet.mockReturnValue(new Promise(() => {}));
            setup();
            await flushPromises();

            expect(mockGet).toHaveBeenCalledWith(PORTAL_URL_ID);
            expect(mockPreview).toHaveBeenCalledWith(PORTAL_URL_ID);
        });

        it('loads the plan of each subscription from its template, expanded', async () => {
            const { source } = await loaded();

            expect(mockGetSubscription).toHaveBeenCalledWith({
                id: 'ppsu_template',
                expanded: true,
            });
            expect(source.subscription.value).toBe(template);
        });

        it('fills the form from the first customer and the first subscription', async () => {
            const { source } = await loaded();

            expect(source.checkoutForm.form.value).toMatchObject({
                type: 'ORGANIZATION',
                email: 'billing@acme.test',
                companyLegalName: 'Acme',
                country: 'NL',
                city: 'Utrecht',
                seatsValues: [{ pricing_item_config_id: 'pic_seats', number: '3' }],
            });
            expect(source.orderMeterValues.value.seatsValues).toStrictEqual([
                { pricing_item_config_id: 'pic_seats', number: '2' },
            ]);
        });

        it('shows the invoice and the total of the preview', async () => {
            const { source } = await loaded();

            expect(source.invoicePreview.value).toMatchObject({ id: 'inv_1' });
            expect(source.amount.value).toStrictEqual({ quantity: '121.00', currency: 'EUR' });
            expect(source.trialInvoicePreview.value).toBeUndefined();
            expect(source.invoicePreviewByBillingPeriod.value).toStrictEqual({});
        });

        it('puts the portal URL id in place of the placeholder in both URLs, and passes the note on', async () => {
            const { source, cancelUrl } = await loaded();

            expect(source.successUrl.value).toBe('https://shop.test/done?session=purl_1');
            expect(cancelUrl.value).toBe('https://shop.test/cancel/purl_1');
            expect(source.note.value).toBe('Read the **terms**.');
        });

        it('previews again when the preview is of an older version than the session', async () => {
            mockGet.mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValueOnce(previewOf(1)).mockResolvedValueOnce(previewOf(2));

            const { source } = await loaded();

            expect(mockPreview).toHaveBeenCalledTimes(2);
            expect(source.invoicePreview.value).toMatchObject({ id: 'inv_2' });
            expect(source.isInvoicePreviewStale.value).toBe(false);
        });

        it('reports a session it cannot read', async () => {
            mockGet.mockRejectedValue(new Error('down'));
            await loaded();

            expect(providerMockLogger.error).toHaveBeenCalledWith(
                'CHECKOUT_SESSION_LOAD_FAILED',
                expect.any(String),
                {},
                expect.any(Error),
            );
        });
    });

    describe('saving an edit', () => {
        it('patches only the keys the customer changed, against the version read', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate).toHaveBeenCalledWith(PORTAL_URL_ID, {
                checkout_session: {
                    expected_version: 1,
                    customers: [{ customer: { email: 'finance@acme.test' } }],
                },
            });
        });

        it('takes the response as the new state and previews it, without reading the session again', async () => {
            mockUpdate.mockResolvedValue(
                portalUrl({ version: 2, note: 'Updated note', success_url: undefined }),
            );
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();
            mockPreview.mockClear();

            source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();

            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(mockPreview).toHaveBeenCalledTimes(1);
            expect(source.note.value).toBe('Updated note');
        });

        it('waits for the customer to stop typing before it patches', async () => {
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'f@acme.test';
            await vi.advanceTimersByTimeAsync(CHECKOUT_SESSION_EDIT_DEBOUNCE_MS / 2);

            expect(mockUpdate).not.toHaveBeenCalled();
            expect(source.isInvoicePreviewStale.value).toBe(true);
        });

        it('sends a changed seat count for the schedule it belongs to', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();

            source.checkoutForm.form.value.seatsValues = [
                { pricing_item_config_id: 'pic_seats', number: '5' },
            ];
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledWith(PORTAL_URL_ID, {
                checkout_session: {
                    expected_version: 1,
                    pricing_plan_subscriptions: [
                        {
                            pricing_plan_schedule_customizations: [
                                {
                                    pricing_plan_schedule_id: 'pps_1',
                                    seats_values: [
                                        { pricing_item_config_id: 'pic_seats', number: '5' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            });
        });

        it('clears the tax ids with null when the customer empties the VAT number', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        {
                            ...createSession().customers[0],
                            customer: {
                                ...createSession().customers[0].customer!,
                                organization: {
                                    legal_name: 'Acme',
                                    registered_address: { country: 'NL', city: 'Utrecht' },
                                    tax_ids: [{ id: 'NL123', type: 'GENERIC_TAX_ID' }],
                                },
                            },
                        },
                    ],
                }),
            );
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();

            source.checkoutForm.form.value.companyVatNumber = '';
            await settleEdits();

            expect(mockUpdate.mock.calls[0][1].checkout_session.customers).toStrictEqual([
                { customer: { organization: { tax_ids: null } } },
            ]);
        });

        it('does not send a group the session shows read-only', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        {
                            ...createSession().customers[0],
                            effective_display: {
                                customer_details: 'READ_ONLY',
                                address: 'EDITABLE',
                                tax_ids: 'HIDDEN',
                                email: 'READ_ONLY',
                                custom_fields: 'HIDDEN',
                            },
                        },
                    ],
                }),
            );
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'other@acme.test';
            source.checkoutForm.form.value.companyLegalName = 'Other';
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('reads the session again and resends the edit on its version when the version was stale', async () => {
            mockUpdate
                .mockRejectedValueOnce(
                    new ApiError({ statusCode: 400, field: 'checkout_session.expected_version' }),
                )
                .mockResolvedValueOnce(portalUrl({ version: 4 }));
            mockPreview.mockResolvedValue(previewOf(4));
            const { source } = await loaded();
            mockGet.mockResolvedValue(portalUrl({ version: 3 }));

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(mockUpdate.mock.calls[1][1]).toStrictEqual({
                checkout_session: {
                    expected_version: 3,
                    customers: [{ customer: { email: 'finance@acme.test' } }],
                },
            });
        });

        it('warns about an edit the API refused, and does not send it again on its own', async () => {
            mockUpdate.mockRejectedValue(new ApiError({ statusCode: 400, field: 'email' }));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(providerMockLogger.warn).toHaveBeenCalledWith(
                'CHECKOUT_SESSION_UPDATE_REFUSED',
                expect.any(String),
                { field: 'email' },
                expect.any(ApiError),
            );
            expect(providerMockLogger.error).not.toHaveBeenCalled();
            expect(providerMockLogger.capture).not.toHaveBeenCalled();
        });

        it('leaves a refused seat count out of later edits until the customer changes it again', async () => {
            mockUpdate
                .mockRejectedValueOnce(
                    new ApiError({
                        statusCode: 400,
                        field: 'checkout_session.pricing_plan_subscriptions.0.pricing_plan_schedule_customizations.0.seats_values.0.number',
                    }),
                )
                .mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();
            const seats = (number: string) => [{ pricing_item_config_id: 'pic_seats', number }];

            source.checkoutForm.form.value.seatsValues = seats('5');
            await settleEdits();
            source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(mockUpdate.mock.calls[1][1]).toStrictEqual({
                checkout_session: {
                    expected_version: 1,
                    customers: [{ customer: { organization: { legal_name: 'Acme BV' } } }],
                },
            });

            source.checkoutForm.form.value.seatsValues = seats('6');
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(3);
            expect(
                mockUpdate.mock.calls[2][1].checkout_session.pricing_plan_subscriptions,
            ).toStrictEqual([
                {
                    pricing_plan_schedule_customizations: [
                        { pricing_plan_schedule_id: 'pps_1', seats_values: seats('6') },
                    ],
                },
            ]);
        });

        it('sends nothing for a session it was just filled from, typed tax ids and all', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        organizationCustomer({
                            legal_name: 'Acme',
                            registered_address: {
                                line1: 'Main 1',
                                postal_code: '3511 AB',
                                city: 'Utrecht',
                                country: 'NL',
                            },
                            tax_ids: [
                                { id: 'NL123456789B01', type: 'EU_VAT' },
                                { id: '12345678', type: 'NL_KVK' },
                            ],
                        }),
                    ],
                }),
            );
            await loaded();
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('sends nothing for an individual whose name the API returns with empty parts', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        {
                            ...createSession().customers[0],
                            customer: {
                                reference: 'cust-ref',
                                type: 'INDIVIDUAL',
                                email: 'ada@home.test',
                                individual: {
                                    name: { first_name: 'Ada', last_name: 'Lovelace', infix: null },
                                    residential_address: { country: 'NL', city: ' Utrecht ' },
                                },
                            } as never,
                        },
                    ],
                }),
            );
            await loaded();
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('replaces only the first tax id when the VAT number changes, keeping its type and the others', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        organizationCustomer({
                            legal_name: 'Acme',
                            registered_address: { country: 'NL', city: 'Utrecht' },
                            tax_ids: [
                                { id: 'NL123456789B01', type: 'EU_VAT' },
                                { id: '12345678', type: 'NL_KVK' },
                            ],
                        }),
                    ],
                }),
            );
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();

            source.checkoutForm.form.value.companyVatNumber = 'NL999999999B01';
            await settleEdits();

            expect(mockUpdate.mock.calls[0][1].checkout_session.customers).toStrictEqual([
                {
                    customer: {
                        organization: {
                            tax_ids: [
                                { id: 'NL999999999B01', type: 'EU_VAT' },
                                { id: '12345678', type: 'NL_KVK' },
                            ],
                        },
                    },
                },
            ]);
        });

        it('never sends the customer type, nor the block of the other type', async () => {
            const { source } = await loaded();

            source.checkoutForm.form.value.type = 'INDIVIDUAL';
            source.checkoutForm.form.value.firstName = 'Ada';
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('sends nothing for a customer that already exists', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        {
                            customer_id: 'cus_1',
                            effective_display: createSession().customers[0].effective_display,
                        },
                    ],
                }),
            );
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            source.checkoutForm.form.value.companyLegalName = 'Acme';
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('leaves a group with an invalid field out, and sends the rest', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'not an email';
            source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();

            expect(mockUpdate.mock.calls[0][1].checkout_session.customers).toStrictEqual([
                { customer: { organization: { legal_name: 'Acme BV' } } },
            ]);
        });

        it.each([
            ['above its maximum', '11'],
            ['below its minimum', '1'],
            ['not a whole number of seats', '3.5'],
        ])('does not send a seat count %s', async (_, number) => {
            const { source } = await loaded();

            source.checkoutForm.form.value.seatsValues = [
                { pricing_item_config_id: 'pic_seats', number },
            ];
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('takes the value the API made of what it was sent, and patches once', async () => {
            mockUpdate.mockResolvedValue(
                portalUrl({
                    version: 2,
                    customers: [
                        {
                            ...createSession().customers[0],
                            customer: {
                                ...createSession().customers[0].customer!,
                                email: 'finance@acme.test',
                            },
                        },
                    ],
                }),
            );
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'Finance@ACME.test';
            await settleEdits();
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(source.checkoutForm.form.value.email).toBe('finance@acme.test');
        });

        it('stops, and warns once, when a save leaves the edit it sent as it was', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();

            source.checkoutForm.form.value.seatsValues = [
                { pricing_item_config_id: 'pic_seats', number: '5' },
            ];
            await settleEdits();
            await settleEdits();
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(
                providerMockLogger.warn.mock.calls.filter(
                    ([code]) => code === 'CHECKOUT_SESSION_EDIT_NOT_APPLIED',
                ),
            ).toHaveLength(1);
            expect(source.isInvoicePreviewStale.value).toBe(false);
        });

        it('after a stale version, sends the same edit and takes what changed elsewhere into the form', async () => {
            mockUpdate
                .mockRejectedValueOnce(
                    new ApiError({ statusCode: 400, field: 'checkout_session.expected_version' }),
                )
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        portalUrl({
                            version: 4,
                            customers: [
                                organizationCustomer(
                                    {
                                        legal_name: 'Acme Holding',
                                        registered_address: { country: 'NL', city: 'Utrecht' },
                                    },
                                    'finance@acme.test',
                                ),
                            ],
                        }),
                    ),
                );
            mockPreview.mockResolvedValue(previewOf(4));
            const { source } = await loaded();
            mockGet.mockResolvedValue(
                portalUrl({
                    version: 3,
                    customers: [
                        organizationCustomer({
                            legal_name: 'Acme Holding',
                            registered_address: { country: 'NL', city: 'Utrecht' },
                        }),
                    ],
                }),
            );

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(mockUpdate.mock.calls[1][1]).toStrictEqual({
                checkout_session: {
                    expected_version: 3,
                    customers: [{ customer: { email: 'finance@acme.test' } }],
                },
            });
            expect(mockUpdate).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['the session is no longer open', portalUrl({ status: 'PROCESSING' })],
            ['the link is closed', portalUrl({ status: 'COMPLETED' }, 'CLOSED')],
        ])('changes nothing when %s', async (_, response) => {
            mockGet.mockResolvedValue(response);
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
            expect(source.canPay?.value).toBe(false);
            expect(source.promotionCode.isAllowed?.value).toBe(false);
        });
    });

    describe('previewing', () => {
        it('stays pending until every preview asked for has answered', async () => {
            let answerSecond!: (preview: CheckoutSessionPreview) => void;
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();
            mockPreview.mockReturnValueOnce(
                new Promise((resolve) => {
                    answerSecond = resolve;
                }),
            );

            source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();
            expect(source.isInvoicePreviewPending.value).toBe(true);

            answerSecond(previewOf(2));
            await flushPromises();
            expect(source.isInvoicePreviewPending.value).toBe(false);
        });

        it('gives up on a preview that stays behind, and asks again when the price is settled', async () => {
            mockGet.mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValue(previewOf(1));
            const { source } = await loaded();

            // One alongside the read, then a few for the version read.
            expect(mockPreview).toHaveBeenCalledTimes(4);
            expect(source.isInvoicePreviewStale.value).toBe(true);

            mockPreview.mockResolvedValue(previewOf(2));
            await expect(source.settleInvoicePreview()).resolves.toBe('SETTLED');
            expect(source.isInvoicePreviewStale.value).toBe(false);
        });
    });

    describe('whether it can be paid', () => {
        it('can once the preview is current and nothing is missing', async () => {
            const { source } = await loaded();

            expect(source.canPay?.value).toBe(true);
        });

        it('cannot while the session lists missing fields', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    missing_fields: [
                        'checkout_session.customers.0.customer.organization.registered_address.country',
                    ],
                }),
            );
            const { source, missingFields } = await loaded();

            expect(source.canPay?.value).toBe(false);
            expect(missingFields.value).toHaveLength(1);
        });

        it('cannot while the preview lists missing fields', async () => {
            mockPreview.mockResolvedValue({
                checkout_session: { version: 1, missing_fields: ['checkout_session.customers.0'] },
            });
            const { source } = await loaded();

            expect(source.canPay?.value).toBe(false);
        });

        it('has no payment step to offer', async () => {
            const { source } = await loaded();

            expect(source.payment).toBeUndefined();
        });
    });

    describe('promotion code', () => {
        it('applies a code to the first schedule of the subscription that takes one, at once', async () => {
            mockUpdate.mockResolvedValue(
                portalUrl({
                    version: 2,
                    pricing_plan_subscriptions: [
                        {
                            ...createSession().pricing_plan_subscriptions[0],
                            pricing_plan_schedule_customizations: [
                                { pricing_plan_schedule_id: 'pps_1', promotion_codes: ['SPRING'] },
                            ],
                        },
                    ],
                }),
            );
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();

            await source.promotionCode.apply(' SPRING ');

            expect(mockUpdate).toHaveBeenCalledWith(PORTAL_URL_ID, {
                checkout_session: {
                    expected_version: 1,
                    pricing_plan_subscriptions: [
                        {
                            pricing_plan_schedule_customizations: [
                                { pricing_plan_schedule_id: 'pps_1', promotion_codes: ['SPRING'] },
                            ],
                        },
                    ],
                },
            });
            expect(source.promotionCode.code.value).toBe('SPRING');
            expect(source.promotionCode.errorMessage.value).toBeNull();
        });

        it('shows an inline error for a code the API turned down, and drops it', async () => {
            mockUpdate.mockRejectedValue(
                new ApiError({
                    statusCode: 400,
                    field: 'checkout_session.pricing_plan_subscriptions.0.pricing_plan_schedule_customizations.0.promotion_codes',
                }),
            );
            const { source } = await loaded();

            await source.promotionCode.apply('NOPE');
            await flushPromises();

            expect(source.promotionCode.errorMessage.value).toBe(
                'This promotion code is not valid.',
            );
            expect(source.promotionCode.code.value).toBeNull();
            expect(source.promotionCode.isPending.value).toBe(false);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });

        it('removes the code with null', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    pricing_plan_subscriptions: [
                        {
                            ...createSession().pricing_plan_subscriptions[0],
                            pricing_plan_schedule_customizations: [
                                { pricing_plan_schedule_id: 'pps_1', promotion_codes: ['SPRING'] },
                            ],
                        },
                    ],
                }),
            );
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();
            expect(source.promotionCode.code.value).toBe('SPRING');

            await source.promotionCode.remove();

            expect(
                mockUpdate.mock.calls[0][1].checkout_session.pricing_plan_subscriptions,
            ).toStrictEqual([
                {
                    pricing_plan_schedule_customizations: [
                        { pricing_plan_schedule_id: 'pps_1', promotion_codes: null },
                    ],
                },
            ]);
            expect(source.promotionCode.code.value).toBeNull();
        });

        it('is not offered when no subscription takes a code', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    pricing_plan_subscriptions: [
                        {
                            ...createSession().pricing_plan_subscriptions[0],
                            options: { allow_promotion_codes: 'NONE' },
                        },
                    ],
                }),
            );
            const { source } = await loaded();

            expect(source.promotionCode.isAllowed?.value).toBe(false);
        });
    });
});
