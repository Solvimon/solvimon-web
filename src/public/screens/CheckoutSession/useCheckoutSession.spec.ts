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

const { mockGet, mockUpdate, mockPreview, mockGetSubscription, mockGetGeoLocation, mockRedirect } =
    vi.hoisted(() => ({
        mockGet: vi.fn(),
        mockGetGeoLocation: vi.fn(),
        mockUpdate: vi.fn(),
        mockPreview: vi.fn(),
        mockGetSubscription: vi.fn(),
        mockRedirect: vi.fn(),
    }));

vi.mock('@/utils/url', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/url')>()),
    safeUrlRedirect: mockRedirect,
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
    createGeoLocationService: () => ({ getGeoLocation: mockGetGeoLocation }),
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

function setup(portalUrlId = PORTAL_URL_ID) {
    let result!: ReturnType<typeof useCheckoutSession>;
    mount(
        defineComponent({
            setup() {
                result = useCheckoutSession({ portalUrlId });
                return () => h('div');
            },
        }),
    );
    return result;
}

async function loaded(portalUrlId?: string) {
    const result = setup(portalUrlId);
    await flushPromises();
    return result;
}

const sectionOf = (source: ReturnType<typeof useCheckoutSession>['source'], index = 0) =>
    source.planCustomizations!.value[index];

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
        mockGetGeoLocation.mockReset().mockRejectedValue(new Error('none'));
        mockRedirect.mockReset();
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

        it('fills the form from the first customer, and the quantities from the subscription', async () => {
            const { source } = await loaded();

            expect(source.checkoutForm.form.value).toMatchObject({
                type: 'ORGANIZATION',
                email: 'billing@acme.test',
                companyLegalName: 'Acme',
                country: 'NL',
                city: 'Utrecht',
            });
            expect(sectionOf(source)).toMatchObject({
                subscription: template,
                minimums: { seatsValues: [{ pricing_item_config_id: 'pic_seats', number: '2' }] },
                maximums: { seatsValues: [{ pricing_item_config_id: 'pic_seats', number: '10' }] },
                editableConfigIds: ['pic_seats'],
            });
            expect(sectionOf(source).seatsValues.value).toStrictEqual([
                { pricing_item_config_id: 'pic_seats', number: '3' },
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
            const { source } = await loaded();

            expect(source.successUrl.value).toBe('https://shop.test/done?session=purl_1');
            expect(source.cancelUrl?.value).toBe('https://shop.test/cancel/purl_1');
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

            sectionOf(source).seatsValues.value = [
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

            sectionOf(source).seatsValues.value = seats('5');
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

            sectionOf(source).seatsValues.value = seats('6');
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

        it('leaves out all of a customer the API refused on a field the edit did not send', async () => {
            mockUpdate
                .mockRejectedValueOnce(
                    new ApiError({
                        statusCode: 400,
                        field: 'checkout_session.customers.0.customer.organization.registration_number',
                    }),
                )
                .mockResolvedValue(portalUrl({ version: 2 }));
            mockPreview.mockResolvedValue(previewOf(2));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();
            sectionOf(source).seatsValues.value = [
                { pricing_item_config_id: 'pic_seats', number: '5' },
            ];
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(mockUpdate.mock.calls[1][1].checkout_session.customers).toBeUndefined();
        });

        it('does not resend an edit the API refused after a stale version', async () => {
            mockUpdate
                .mockRejectedValueOnce(
                    new ApiError({ statusCode: 400, field: 'checkout_session.expected_version' }),
                )
                .mockRejectedValueOnce(
                    new ApiError({
                        statusCode: 400,
                        field: 'checkout_session.customers.0.customer.email',
                    }),
                );
            const { source } = await loaded();
            mockGet.mockResolvedValue(portalUrl({ version: 3 }));

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();
            mockUpdate.mockResolvedValue(portalUrl({ version: 4 }));
            source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(3);
            expect(mockUpdate.mock.calls[2][1].checkout_session.customers).toStrictEqual([
                { customer: { organization: { legal_name: 'Acme BV' } } },
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

            sectionOf(source).seatsValues.value = [{ pricing_item_config_id: 'pic_seats', number }];
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

            sectionOf(source).seatsValues.value = [
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

    describe('several customers', () => {
        const individualCustomer: CheckoutSession['customers'][number] = {
            ...createSession().customers[0],
            customer: {
                reference: 'person-ref',
                type: 'INDIVIDUAL',
                email: 'jane@example.test',
                individual: {
                    name: { first_name: 'Jane', last_name: 'Doe' },
                    residential_address: { country: 'BE' },
                },
            },
        };
        const existingCustomer: CheckoutSession['customers'][number] = {
            customer_id: 'cus_1',
            effective_display: createSession().customers[0].effective_display,
        };
        const formsOf = (result: ReturnType<typeof useCheckoutSession>) =>
            result.source.customerForms?.value ?? [];

        it('gives each customer a form of its own, in session order, named after the customer', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ customers: [createSession().customers[0], individualCustomer] }),
            );
            const result = await loaded();
            const [first, second] = formsOf(result);

            expect(formsOf(result)).toHaveLength(2);
            expect(first.form).toBe(result.source.checkoutForm);
            expect(first).toMatchObject({ title: 'Acme', isTypeLocked: true });
            expect(second).toMatchObject({ title: 'Jane Doe', isTypeLocked: true });
            expect(second.form.form.value).toMatchObject({
                type: 'INDIVIDUAL',
                email: 'jane@example.test',
                firstName: 'Jane',
                country: 'BE',
            });
        });

        it("names a single customer's form with the default title", async () => {
            const result = await loaded();

            expect(formsOf(result)[0].title).toBeUndefined();
        });

        it('does not guess the country of a customer without one, so nothing is patched', async () => {
            mockGetGeoLocation.mockResolvedValue({ ip: '127.0.0.1', country: 'DE' });
            mockGet.mockResolvedValue(
                portalUrl({ customers: [organizationCustomer({ legal_name: 'Acme' })] }),
            );
            const { source } = await loaded();
            await settleEdits();

            expect(mockGetGeoLocation).not.toHaveBeenCalled();
            expect(source.checkoutForm.form.value.country).toBeUndefined();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('patches nothing on load', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ customers: [createSession().customers[0], individualCustomer] }),
            );
            await loaded();
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('sends an edit of a later customer in its own position', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ customers: [createSession().customers[0], individualCustomer] }),
            );
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const result = await loaded();

            formsOf(result)[1].form.form.value.lastName = 'Smith';
            await settleEdits();

            expect(mockUpdate.mock.calls[0][1].checkout_session.customers).toStrictEqual([
                {},
                { customer: { individual: { name: { last_name: 'Smith' } } } },
            ]);
        });

        it('shows no form for a customer that already exists, and never sends it', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ customers: [existingCustomer, individualCustomer] }),
            );
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const result = await loaded();

            expect(formsOf(result).map(({ title }) => title)).toStrictEqual(['Jane Doe']);
            expect(result.source.checkoutForm.validation.value.$invalid).toBe(false);

            result.source.checkoutForm.form.value.email = 'finance@acme.test';
            formsOf(result)[0].form.form.value.email = 'jane@doe.test';
            await settleEdits();

            expect(mockUpdate.mock.calls[0][1].checkout_session.customers).toStrictEqual([
                {},
                { customer: { email: 'jane@doe.test' } },
            ]);
        });

        it('leaves a refused part of one customer out, and keeps sending the other customer', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ customers: [createSession().customers[0], individualCustomer] }),
            );
            mockUpdate.mockRejectedValueOnce(
                new ApiError({
                    statusCode: 400,
                    field: 'checkout_session.customers.1.customer.email',
                }),
            );
            const result = await loaded();

            formsOf(result)[1].form.form.value.email = 'jane@doe.test';
            await settleEdits();
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            result.source.checkoutForm.form.value.companyLegalName = 'Acme BV';
            await settleEdits();

            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(mockUpdate.mock.calls[1][1].checkout_session.customers).toStrictEqual([
                { customer: { organization: { legal_name: 'Acme BV' } } },
            ]);
        });
    });

    describe('missing fields', () => {
        const missingCountry =
            'checkout_session.customers.0.customer.organization.registered_address.country';

        it('shows a field the session misses as needing input, before it is touched', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [organizationCustomer({ legal_name: 'Acme' })],
                    missing_fields: [
                        missingCountry,
                        'checkout_session.customers.0.customer.organization.registered_address.line1',
                    ],
                }),
            );
            const { source } = await loaded();
            const validation = source.checkoutForm.validation.value;

            expect(validation.country.$errors).not.toHaveLength(0);
            expect(validation.addressLine1.$errors).not.toHaveLength(0);
            expect(source.checkoutForm.getIsFieldRequired('addressLine1')).toBe(true);
            expect(validation.city.$dirty).toBe(false);
        });

        it('does not mark a missing field before the session is read', async () => {
            mockGet.mockReturnValue(new Promise(() => {}));
            mockPreview.mockResolvedValue({
                checkout_session: { version: 1, missing_fields: [missingCountry] },
            });
            const { source } = setup();
            await flushPromises();

            expect(source.checkoutForm.validation.value.country.$dirty).toBe(false);
        });

        it('does not ask for a field the customer cannot edit', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    customers: [
                        {
                            ...organizationCustomer({ legal_name: 'Acme' }, ''),
                            effective_display: {
                                ...createSession().customers[0].effective_display,
                                address: 'READ_ONLY',
                                email: 'HIDDEN',
                            },
                        },
                    ],
                    missing_fields: [missingCountry],
                }),
            );
            const { source } = await loaded();

            expect(source.checkoutForm.validation.value.$invalid).toBe(false);
        });
    });

    describe('previewing', () => {
        it('warns once when the preview holds more than one invoice', async () => {
            const two = previewOf(1);
            two.invoices = [...two.invoices!, ...two.invoices!];
            mockPreview.mockResolvedValue(two);
            mockUpdate.mockResolvedValue(portalUrl({ version: 2 }));
            const { source } = await loaded();
            mockPreview.mockResolvedValue({ ...two, checkout_session: { version: 2 } });

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(
                providerMockLogger.warn.mock.calls.filter(
                    ([code]) => code === 'CHECKOUT_SESSION_SEVERAL_INVOICES',
                ),
            ).toHaveLength(1);
            expect(source.invoicePreview.value).toMatchObject({ id: 'inv_1' });
        });

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

    describe('several subscriptions', () => {
        const second: CheckoutSession['pricing_plan_subscriptions'][number] = {
            template_pricing_plan_subscription_id: 'ppsu_second',
            pricing_plan_subscription: { reference: 'second-ref', customer_reference: 'cust-ref' },
            options: {
                edit_units: [
                    {
                        pricing_item_config_id: 'pic_units',
                        min: { number: '0.5' },
                        max: { number: '4' },
                    },
                ],
                allow_promotion_codes: 'SINGLE',
            },
            starting_values: [
                {
                    pricing_plan_schedule_id: 'pps_2',
                    seats_values: [{ pricing_item_config_id: 'pic_fixed', number: '7' }],
                    units: [{ pricing_item_config_id: 'pic_units', number: '1.5' }],
                },
            ],
        };
        const secondTemplate = {
            id: 'ppsu_second',
            name: 'Hardware',
            pricing_plan_schedule_infos: [],
        } as unknown as PricingPlanSubscriptionExpanded;
        const twoSubscriptions = (
            subscriptions = [createSession().pricing_plan_subscriptions[0], second],
            overrides: Partial<CheckoutSession> = {},
        ) => portalUrl({ pricing_plan_subscriptions: subscriptions, ...overrides });

        beforeEach(() => {
            mockGet.mockResolvedValue(twoSubscriptions());
            mockGetSubscription.mockImplementation(({ id }: { id: string }) =>
                Promise.resolve(id === 'ppsu_second' ? secondTemplate : template),
            );
        });

        it('gives each subscription a section of its own, named after its plan', async () => {
            const { source } = await loaded();
            const [first, other] = source.planCustomizations!.value;

            expect(first).toMatchObject({
                key: '0',
                subscription: template,
                title: 'Subscription',
            });
            expect(other).toMatchObject({
                key: '1',
                subscription: secondTemplate,
                title: 'Hardware',
            });
        });

        it('starts each config at its starting value, and lets only the listed ones be changed', async () => {
            const { source } = await loaded();
            const other = sectionOf(source, 1);

            expect(other.seatsValues.value).toStrictEqual([
                { pricing_item_config_id: 'pic_fixed', number: '7' },
            ]);
            expect(other.unitsValues.value).toStrictEqual([
                { pricing_item_config_id: 'pic_units', number: '1.5' },
            ]);
            expect(other.editableConfigIds).toStrictEqual(['pic_units']);
            expect(other.minimums.unitsValues).toStrictEqual([
                { pricing_item_config_id: 'pic_units', number: '0.5' },
            ]);
            expect(other.maximums.unitsValues).toStrictEqual([
                { pricing_item_config_id: 'pic_units', number: '4' },
            ]);
        });

        it('starts a listed config the session has no value for at its minimum', async () => {
            mockGet.mockResolvedValue(
                twoSubscriptions([
                    createSession().pricing_plan_subscriptions[0],
                    { ...second, starting_values: [{ pricing_plan_schedule_id: 'pps_2' }] },
                ]),
            );
            const { source } = await loaded();
            await settleEdits();

            expect(sectionOf(source, 1).unitsValues.value).toStrictEqual([
                { pricing_item_config_id: 'pic_units', number: '0.5' },
            ]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('sends a config the session has no value for once the customer changes it', async () => {
            mockGet.mockResolvedValue(
                twoSubscriptions([
                    createSession().pricing_plan_subscriptions[0],
                    { ...second, starting_values: [{ pricing_plan_schedule_id: 'pps_2' }] },
                ]),
            );
            mockUpdate.mockResolvedValue(twoSubscriptions(undefined, { version: 2 }));
            const { source } = await loaded();

            sectionOf(source, 1).unitsValues.value = [
                { pricing_item_config_id: 'pic_units', number: '1' },
            ];
            await settleEdits();

            expect(
                mockUpdate.mock.calls[0][1].checkout_session.pricing_plan_subscriptions[1],
            ).toStrictEqual({
                pricing_plan_schedule_customizations: [
                    {
                        pricing_plan_schedule_id: 'pps_2',
                        units: [{ pricing_item_config_id: 'pic_units', number: '1' }],
                    },
                ],
            });
        });

        it('sends a fractional unit count of a later subscription in its own position, on its schedule', async () => {
            mockUpdate.mockResolvedValue(twoSubscriptions(undefined, { version: 2 }));
            const { source } = await loaded();

            sectionOf(source, 1).unitsValues.value = [
                { pricing_item_config_id: 'pic_units', number: '2.5' },
            ];
            await settleEdits();

            expect(
                mockUpdate.mock.calls[0][1].checkout_session.pricing_plan_subscriptions,
            ).toStrictEqual([
                {},
                {
                    pricing_plan_schedule_customizations: [
                        {
                            pricing_plan_schedule_id: 'pps_2',
                            units: [{ pricing_item_config_id: 'pic_units', number: '2.5' }],
                        },
                    ],
                },
            ]);
        });

        it.each([
            ['a unit count above its maximum', 'unitsValues', 'pic_units', '4.5'],
            ['a unit count below its minimum', 'unitsValues', 'pic_units', '0.25'],
            [
                'a config the session does not let the customer change',
                'seatsValues',
                'pic_fixed',
                '8',
            ],
        ] as const)('does not send %s', async (_, key, id, number) => {
            const { source } = await loaded();

            sectionOf(source, 1)[key].value = [{ pricing_item_config_id: id, number }];
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('patches nothing and previews once on load', async () => {
            await loaded();
            await settleEdits();

            expect(mockUpdate).not.toHaveBeenCalled();
            expect(mockPreview).toHaveBeenCalledTimes(1);
        });

        describe('promotion codes', () => {
            const withCode = (index: number, code: string, version = 2) => {
                const subscriptions = [createSession().pricing_plan_subscriptions[0], second];
                subscriptions[index] = {
                    ...subscriptions[index],
                    pricing_plan_schedule_customizations: [
                        {
                            pricing_plan_schedule_id: index === 0 ? 'pps_1' : 'pps_2',
                            promotion_codes: [code],
                        },
                    ],
                };
                return twoSubscriptions(subscriptions, { version });
            };
            const refusedOn = (index: number) =>
                new ApiError({
                    statusCode: 400,
                    field: `checkout_session.pricing_plan_subscriptions.${index}.pricing_plan_schedule_customizations.0.promotion_codes`,
                });

            it('offers a code per subscription that takes one, instead of one for the order', async () => {
                const { source } = await loaded();

                expect(source.promotionCode.isAllowed?.value).toBe(false);
                expect(sectionOf(source, 0).promotionCode?.isAllowed?.value).toBe(true);
                expect(sectionOf(source, 1).promotionCode?.isAllowed?.value).toBe(true);
            });

            it('keeps the single code of the order when only one subscription takes one', async () => {
                mockGet.mockResolvedValue(
                    twoSubscriptions([
                        createSession().pricing_plan_subscriptions[0],
                        {
                            ...second,
                            options: { ...second.options, allow_promotion_codes: 'NONE' },
                        },
                    ]),
                );
                const { source } = await loaded();

                expect(source.promotionCode.isAllowed?.value).toBe(true);
                expect(sectionOf(source, 0).promotionCode).toBeUndefined();
                expect(sectionOf(source, 1).promotionCode).toBeUndefined();
            });

            it('applies a code to the first schedule of its own subscription', async () => {
                mockUpdate.mockResolvedValue(withCode(1, 'SPRING'));
                mockPreview.mockResolvedValue(previewOf(2));
                const { source } = await loaded();

                await sectionOf(source, 1).promotionCode!.apply('SPRING');

                expect(
                    mockUpdate.mock.calls[0][1].checkout_session.pricing_plan_subscriptions,
                ).toStrictEqual([
                    {},
                    {
                        pricing_plan_schedule_customizations: [
                            { pricing_plan_schedule_id: 'pps_2', promotion_codes: ['SPRING'] },
                        ],
                    },
                ]);
                expect(sectionOf(source, 1).promotionCode!.code.value).toBe('SPRING');
                expect(sectionOf(source, 0).promotionCode!.code.value).toBeNull();
            });

            it('shows a refused code inline on the subscription the error names', async () => {
                mockUpdate.mockRejectedValue(refusedOn(1));
                const { source } = await loaded();

                await sectionOf(source, 1).promotionCode!.apply('NOPE');
                await flushPromises();

                expect(sectionOf(source, 1).promotionCode!.errorMessage.value).toBe(
                    'This promotion code is not valid.',
                );
                expect(sectionOf(source, 0).promotionCode!.errorMessage.value).toBeNull();
                expect(mockUpdate).toHaveBeenCalledTimes(1);
            });

            it("applies one subscription's code after the other's was refused in the same save", async () => {
                mockUpdate
                    .mockRejectedValueOnce(refusedOn(1))
                    .mockResolvedValueOnce(withCode(0, 'SPRING'));
                mockPreview.mockResolvedValue(previewOf(2));
                const { source } = await loaded();

                const applied = sectionOf(source, 0).promotionCode!.apply('SPRING');
                const refused = sectionOf(source, 1).promotionCode!.apply('NOPE');
                await Promise.all([applied, refused]);
                await flushPromises();

                expect(mockUpdate).toHaveBeenCalledTimes(2);
                expect(
                    mockUpdate.mock.calls[1][1].checkout_session.pricing_plan_subscriptions,
                ).toStrictEqual([
                    {
                        pricing_plan_schedule_customizations: [
                            { pricing_plan_schedule_id: 'pps_1', promotion_codes: ['SPRING'] },
                        ],
                    },
                ]);
                expect(sectionOf(source, 0).promotionCode!.code.value).toBe('SPRING');
                expect(sectionOf(source, 0).promotionCode!.errorMessage.value).toBeNull();
                expect(sectionOf(source, 1).promotionCode!.errorMessage.value).toBe(
                    'This promotion code is not valid.',
                );
            });
        });
    });

    describe('cancel link', () => {
        it.each([
            ['a script URL', 'javascript:alert(1)'],
            ['a relative URL', '/cancel'],
            ['a data URL', 'data:text/html,<p>hi</p>'],
            ['a protocol-relative URL', '//evil.test/cancel'],
        ])('leaves out %s', async (_, cancelUrl) => {
            mockGet.mockResolvedValue(portalUrl({ cancel_url: cancelUrl }));
            const { source } = await loaded();

            expect(source.cancelUrl?.value).toBeUndefined();
        });

        it('encodes the portal URL id it puts in place of the placeholder', async () => {
            mockGet.mockResolvedValue({
                ...portalUrl({ cancel_url: 'https://shop.test/c?id={CHECKOUT_SESSION_ID}' }),
            });
            const { source } = await loaded();

            expect(source.cancelUrl?.value).toBe('https://shop.test/c?id=purl_1');
        });

        it('encodes an id that needs it, at every placeholder', async () => {
            mockGet.mockResolvedValue(
                portalUrl({
                    cancel_url:
                        'https://shop.test/c/{CHECKOUT_SESSION_ID}?again={CHECKOUT_SESSION_ID}',
                    success_url: 'https://shop.test/done/{CHECKOUT_SESSION_ID}',
                }),
            );
            const { source } = await loaded('a b/c');

            expect(source.cancelUrl?.value).toBe('https://shop.test/c/a%20b%2Fc?again=a%20b%2Fc');
            expect(source.successUrl.value).toBe('https://shop.test/done/a%20b%2Fc');
        });
    });

    describe('a session that cannot be read', () => {
        it('says the session could not be loaded on a server error', async () => {
            mockGet.mockRejectedValue(new ApiError({ statusCode: 503 }));
            const { loadFailure, endState } = await loaded();

            expect(loadFailure.value).toStrictEqual({});
            expect(endState.value).toBeUndefined();
        });

        it('says how the link ended on a 410', async () => {
            mockGet.mockRejectedValue(
                new ApiError({
                    statusCode: 410,
                    errorCode: 'CHECKOUT_SESSION_CLOSED',
                    checkoutSessionStatus: 'FAILED',
                }),
            );
            const { loadFailure } = await loaded();

            expect(loadFailure.value).toStrictEqual({ reason: 'closed', status: 'FAILED' });
        });

        it('has no failure while the session loads fine', async () => {
            const { loadFailure } = await loaded();

            expect(loadFailure.value).toBeUndefined();
        });
    });

    describe('a session that has ended', () => {
        it('goes to the success URL of a completed session, with its id in place', async () => {
            mockGet.mockResolvedValue(portalUrl({ status: 'COMPLETED' }, 'CLOSED'));
            const { endState, isRedirecting } = await loaded();

            expect(endState.value).toBe('COMPLETED');
            expect(isRedirecting.value).toBe(true);
            expect(mockRedirect).toHaveBeenCalledWith('https://shop.test/done?session=purl_1');
        });

        it('does not go to a success URL that is not a web address', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ status: 'COMPLETED', success_url: 'javascript:alert(1)' }, 'CLOSED'),
            );
            const { endState, isRedirecting } = await loaded();

            expect(endState.value).toBe('COMPLETED');
            expect(isRedirecting.value).toBe(false);
            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('ends, and goes to the success URL, when a save returns a completed session', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ status: 'COMPLETED', version: 2 }, 'CLOSED'));
            const { source, endState } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(endState.value).toBe('COMPLETED');
            expect(mockRedirect).toHaveBeenCalledWith('https://shop.test/done?session=purl_1');
        });

        it('ends when a save returns a session that is no longer open', async () => {
            mockUpdate.mockResolvedValue(portalUrl({ status: 'PROCESSING', version: 2 }));
            const { source, endState } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();

            expect(endState.value).toBe('PROCESSING');
            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('shows a completed session without a success URL as completed', async () => {
            mockGet.mockResolvedValue(
                portalUrl({ status: 'COMPLETED', success_url: undefined }, 'CLOSED'),
            );
            const { endState, isRedirecting } = await loaded();

            expect(endState.value).toBe('COMPLETED');
            expect(isRedirecting.value).toBe(false);
            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it.each([
            ['FAILED', portalUrl({ status: 'FAILED' }, 'CLOSED')],
            ['PROCESSING', portalUrl({ status: 'PROCESSING' })],
            ['CLOSED', portalUrl({}, 'CLOSED')],
        ])('ends as %s without redirecting', async (state, response) => {
            mockGet.mockResolvedValue(response);
            const { endState } = await loaded();

            expect(endState.value).toBe(state);
            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('loads no plan, patches nothing and previews no more than once', async () => {
            mockGet.mockResolvedValue(portalUrl({ status: 'FAILED', version: 3 }, 'CLOSED'));
            const { source } = await loaded();

            source.checkoutForm.form.value.email = 'finance@acme.test';
            await settleEdits();
            await settleEdits();

            expect(mockGetSubscription).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
            expect(mockPreview).toHaveBeenCalledTimes(1);
            expect(source.planCustomizations?.value).toStrictEqual([]);
        });

        it('is not ended while the session is open', async () => {
            const { endState } = await loaded();

            expect(endState.value).toBeUndefined();
        });
    });
});
