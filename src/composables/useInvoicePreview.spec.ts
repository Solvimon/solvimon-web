import type {
    Customer,
    Invoice,
    InvoicePreview,
    Pricing,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { flushPromises } from '@vue/test-utils';
import { useInvoicePreview } from './useInvoicePreview';

const { mockGetInvoicePreview } = vi.hoisted(() => ({
    mockGetInvoicePreview:
        vi.fn<
            (args: {
                pricingPlanSubscriptionId: PricingPlanSubscriptionExpanded['id'];
                startAt?: PricingPlanSchedule['start_at'];
                customizations?: PricingPlanScheduleCustomization[];
                customer: unknown;
            }) => Promise<InvoicePreview>
        >(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: vi.fn(() => ({
        getInvoicePreview: mockGetInvoicePreview,
    })),
}));

const individualCustomer = (country: string): Partial<Customer> => ({
    type: 'INDIVIDUAL',
    individual: {
        residential_address: { country },
    },
});

describe('useInvoicePreview', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('loads invoice preview data and populates refs when trial schedule exists', async () => {
        const subscription = {
            id: 'sub_123',
            pricing_plan_schedule_infos: [
                {
                    id: 'trial_schedule_id',
                    start_at: '2024-01-01T00:00:00.000Z',
                    end_at: '2024-01-10T00:00:00.000Z',
                    pricing_plan_schedule: {
                        type: 'TRIAL',
                        start_at: '2024-01-01T00:00:00.000Z',
                        end_at: '2024-01-10T00:00:00.000Z',
                    },
                },
                {
                    id: 'default_schedule_id',
                    start_at: '2024-02-01T00:00:00.000Z',
                    pricing_plan_schedule: {
                        type: 'DEFAULT',
                    },
                },
            ],
            billing_currency: 'GBP',
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        const customer: Partial<Customer> = {
            type: 'ORGANIZATION',
            organization: {
                legal_name: 'Acme Corp',
                registered_address: {
                    line1: 'Main street 1',
                    city: 'Amsterdam',
                    postal_code: '1000AA',
                    state: 'NH',
                    country: '',
                },
            },
        };

        const subscriptionStartAt = '2024-02-01T00:00:00.000Z' as PricingPlanSchedule['start_at'];
        const enabledPricingIds = ['pricing_1'];

        const trialInvoice = { id: 'trial_invoice_id' } as Invoice;
        const defaultInvoice = { id: 'default_invoice_id' } as Invoice;
        const invoicePreviewResponse = {
            first_invoice: trialInvoice,
            invoice_infos: [
                {
                    pricing_plan_schedule_id: 'default_schedule_id',
                    invoices: [defaultInvoice],
                },
            ],
        } as unknown as InvoicePreview;

        mockGetInvoicePreview.mockResolvedValue(invoicePreviewResponse);

        const { loadInvoicePreview, trialInvoicePreview, trialPeriod, invoicePreview } =
            useInvoicePreview();

        await loadInvoicePreview({
            subscription,
            subscriptionStartAt,
            customer,
            enabledPricingIds,
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledTimes(1);
        expect(mockGetInvoicePreview).toHaveBeenCalledWith({
            pricingPlanSubscriptionId: 'sub_123',
            startAt: subscriptionStartAt,
            customizations: [
                {
                    pricing_plan_schedule_id: 'default_schedule_id',
                    enabled_pricings: [{ pricing_id: 'pricing_1' }],
                    seats_values: undefined,
                },
            ],
            customer: {
                type: 'ORGANIZATION',
                organization: {
                    legal_name: 'Acme Corp',
                    registered_address: {
                        line1: 'Main street 1',
                        city: 'Amsterdam',
                        state: 'NH',
                        country: 'NL',
                        postal_code: '1000AA',
                    },
                },
            },
        });

        expect(trialInvoicePreview.value).toEqual(trialInvoice);
        expect(trialPeriod.value).toEqual({ type: 'DAY', value: 9 });
        expect(invoicePreview.value).toEqual(defaultInvoice);
    });

    it('falls back to placeholder customer details when no customer is given', async () => {
        const subscription = {
            id: 'sub_124',
            pricing_plan_schedule_infos: [
                {
                    id: 'default_schedule_id',
                    pricing_plan_schedule: { type: 'DEFAULT' },
                },
            ],
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        mockGetInvoicePreview.mockResolvedValue({
            first_invoice: { id: 'first' },
            invoice_infos: [],
        } as unknown as InvoicePreview);

        const { loadInvoicePreview } = useInvoicePreview();
        await loadInvoicePreview({ subscription });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith(
            expect.objectContaining({
                customer: {
                    type: 'INDIVIDUAL',
                    individual: {
                        residential_address: { country: 'NL' },
                    },
                },
            }),
        );
    });

    it('uses pricing currency from country when supported, otherwise default currency settings', () => {
        const subscription = {
            id: 'sub_456',
            pricing_plan_schedule_infos: [
                {
                    id: 'default_schedule_id',
                    pricing_plan_schedule: {
                        type: 'DEFAULT',
                    },
                    pricing_plan_version: {
                        billing_period_settings: {
                            billing_periods: [
                                {
                                    period: { type: 'MONTH', value: 1 },
                                },
                            ],
                        },
                        pricing_currency_settings: {
                            default_pricing_currency: 'BRL',
                            pricing_currencies: ['BRL', 'AUD'],
                        },
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        const { loadInvoicePreview } = useInvoicePreview();

        void loadInvoicePreview({
            subscription,
            customer: individualCustomer('NL'),
            enabledPricingIds: undefined,
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith({
            pricingPlanSubscriptionId: 'sub_456',
            startAt: undefined,
            customizations: [],
            customer: {
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: {
                        country: 'NL',
                    },
                },
            },
        });

        mockGetInvoicePreview.mockClear();

        void loadInvoicePreview({
            subscription,
            customer: individualCustomer('AU'),
            enabledPricingIds: undefined,
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith({
            pricingPlanSubscriptionId: 'sub_456',
            startAt: undefined,
            customizations: [],
            customer: {
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: {
                        country: 'AU',
                    },
                },
            },
        });
    });

    it('includes pricing_currency and billing_period in customizations only for multi settings', async () => {
        const subscription = {
            id: 'sub_789',
            billing_currency: 'AUD',
            billing_period: { type: 'MONTH', value: 1 },
            pricing_plan_schedule_infos: [
                {
                    id: 'default_schedule_id',
                    pricing_plan_schedule: { type: 'DEFAULT' },
                    pricing_plan_version: {
                        pricing_currency_settings: {
                            default_pricing_currency: 'AUD',
                            pricing_currencies: ['AUD', 'BRL'],
                        },
                        billing_period_settings: {
                            billing_periods: [
                                { period: { type: 'MONTH', value: 1 } },
                                { period: { type: 'YEAR', value: 1 } },
                            ],
                        },
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        const invoicePreviewResponse = {
            first_invoice: { id: 'first' },
            invoice_infos: [],
        } as unknown as InvoicePreview;
        mockGetInvoicePreview.mockResolvedValue(invoicePreviewResponse);

        const { loadInvoicePreview } = useInvoicePreview();
        await loadInvoicePreview({
            subscription,
            customer: individualCustomer('AU'),
            enabledPricingIds: ['pricing_1' as Pricing['id']],
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith(
            expect.objectContaining({
                customizations: [
                    expect.objectContaining({
                        pricing_currency: 'AUD',
                        billing_period: { type: 'MONTH', value: 1 },
                        enabled_pricings: [{ pricing_id: 'pricing_1' }],
                    }),
                ],
            }),
        );
    });

    it('includes only billing_period when only multi billing period settings exist', async () => {
        const subscription = {
            id: 'sub_790',
            billing_currency: 'AUD',
            billing_period: { type: 'YEAR', value: 1 },
            pricing_plan_schedule_infos: [
                {
                    id: 'default_schedule_id',
                    pricing_plan_schedule: { type: 'DEFAULT' },
                    pricing_plan_version: {
                        billing_period_settings: {
                            billing_periods: [
                                { period: { type: 'MONTH', value: 1 } },
                                { period: { type: 'YEAR', value: 1 } },
                            ],
                        },
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        mockGetInvoicePreview.mockResolvedValue({
            first_invoice: { id: 'first' },
            invoice_infos: [],
        } as unknown as InvoicePreview);

        const { loadInvoicePreview } = useInvoicePreview();
        await loadInvoicePreview({
            subscription,
            customer: individualCustomer('AU'),
            enabledPricingIds: ['pricing_1' as Pricing['id']],
        });

        const payload = mockGetInvoicePreview.mock.calls[0][0];
        const customization = payload.customizations?.[0];

        expect(customization?.billing_period).toEqual({ type: 'MONTH', value: 1 });
        expect(customization).not.toHaveProperty('pricing_currency');
    });

    it('includes only pricing_currency when only multi pricing currency settings exist', async () => {
        const subscription = {
            id: 'sub_791',
            billing_currency: 'AUD',
            billing_period: { type: 'MONTH', value: 1 },
            pricing_plan_schedule_infos: [
                {
                    id: 'default_schedule_id',
                    pricing_plan_schedule: { type: 'DEFAULT' },
                    pricing_plan_version: {
                        pricing_currency_settings: {
                            default_pricing_currency: 'AUD',
                            pricing_currencies: ['AUD', 'BRL'],
                        },
                        billing_period_settings: {
                            billing_periods: [{ period: { type: 'MONTH', value: 1 } }],
                        },
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        mockGetInvoicePreview.mockResolvedValue({
            first_invoice: { id: 'first' },
            invoice_infos: [],
        } as unknown as InvoicePreview);

        const { loadInvoicePreview } = useInvoicePreview();
        await loadInvoicePreview({
            subscription,
            customer: individualCustomer('AU'),
            enabledPricingIds: ['pricing_1' as Pricing['id']],
        });

        const payload = mockGetInvoicePreview.mock.calls[0][0];
        const customization = payload.customizations?.[0];

        expect(customization?.pricing_currency).toBe('AUD');
        expect(customization).not.toHaveProperty('billing_period');
    });

    describe('previews answering out of order', () => {
        const subscription = {
            id: 'sub_125',
            pricing_plan_schedule_infos: [
                { id: 'default_schedule_id', pricing_plan_schedule: { type: 'DEFAULT' } },
            ],
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        const previewFor = (id: string) =>
            ({
                first_invoice: { id },
                invoice_infos: [
                    { pricing_plan_schedule_id: 'default_schedule_id', invoices: [{ id }] },
                ],
            }) as unknown as InvoicePreview;

        function controlledPreviews() {
            const pending: {
                resolve: (preview: InvoicePreview) => void;
                reject: (error: Error) => void;
            }[] = [];
            mockGetInvoicePreview.mockImplementation(
                () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
            );
            return pending;
        }

        it('keeps the preview asked for last when an earlier one answers after it', async () => {
            const pending = controlledPreviews();
            const { loadInvoicePreview, invoicePreview, isPending } = useInvoicePreview();

            const nl = loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            const us = loadInvoicePreview({ subscription, customer: individualCustomer('US') });
            pending[1]!.resolve(previewFor('inv_us'));
            await us;
            pending[0]!.resolve(previewFor('inv_nl'));
            await nl;

            expect(invoicePreview.value).toEqual({ id: 'inv_us' });
            expect(isPending.value).toBe(false);
        });

        it('stays pending until the preview asked for last answers', async () => {
            const pending = controlledPreviews();
            const { loadInvoicePreview, isPending } = useInvoicePreview();

            void loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            void loadInvoicePreview({ subscription, customer: individualCustomer('US') });
            pending[0]!.resolve(previewFor('inv_nl'));
            await flushPromises();

            expect(isPending.value).toBe(true);
        });

        it('asks again for a preview that failed', async () => {
            mockGetInvoicePreview
                .mockRejectedValueOnce(new Error('Boom'))
                .mockResolvedValueOnce(previewFor('inv_nl'));
            const { loadInvoicePreview, invoicePreview } = useInvoicePreview();

            await expect(
                loadInvoicePreview({ subscription, customer: individualCustomer('NL') }),
            ).rejects.toThrow('Boom');
            await loadInvoicePreview({ subscription, customer: individualCustomer('NL') });

            expect(mockGetInvoicePreview).toHaveBeenCalledTimes(2);
            expect(invoicePreview.value).toEqual({ id: 'inv_nl' });
        });

        it('returns to a preview it holds while another is still out', async () => {
            const pending = controlledPreviews();
            const { loadInvoicePreview, invoicePreview } = useInvoicePreview();

            const nl = loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            pending[0]!.resolve(previewFor('inv_nl'));
            await nl;

            const us = loadInvoicePreview({ subscription, customer: individualCustomer('US') });
            await loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            pending[1]!.resolve(previewFor('inv_us'));
            await us;

            expect(mockGetInvoicePreview).toHaveBeenCalledTimes(2);
            expect(invoicePreview.value).toEqual({ id: 'inv_nl' });
        });

        // A promotion code applied through a preview a later one took over has to learn whether
        // the later preview, which carries the same code, was accepted.
        it('settles a preview a later one took over as that one does', async () => {
            const pending = controlledPreviews();
            const { loadInvoicePreview } = useInvoicePreview();

            const nl = loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            const us = loadInvoicePreview({ subscription, customer: individualCustomer('US') });
            pending[0]!.resolve(previewFor('inv_nl'));
            pending[1]!.reject(new Error('Boom'));

            await expect(nl).rejects.toThrow('Boom');
            await expect(us).rejects.toThrow('Boom');
        });
    });

    describe('whenLoaded', () => {
        const subscription = {
            id: 'sub_126',
            pricing_plan_schedule_infos: [
                { id: 'default_schedule_id', pricing_plan_schedule: { type: 'DEFAULT' } },
            ],
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        it('settles as the preview asked for last, including one asked for after it', async () => {
            const pending: ((preview: InvoicePreview) => void)[] = [];
            mockGetInvoicePreview.mockImplementation(
                () => new Promise((resolve) => pending.push(resolve)),
            );
            const { loadInvoicePreview, whenLoaded, invoicePreview } = useInvoicePreview();

            void loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            const loaded = whenLoaded();
            void loadInvoicePreview({ subscription, customer: individualCustomer('DE') });
            pending[0]!({
                first_invoice: { id: 'inv_nl' },
                invoice_infos: [
                    {
                        pricing_plan_schedule_id: 'default_schedule_id',
                        invoices: [{ id: 'inv_nl' }],
                    },
                ],
            } as unknown as InvoicePreview);
            pending[1]!({
                first_invoice: { id: 'inv_de' },
                invoice_infos: [
                    {
                        pricing_plan_schedule_id: 'default_schedule_id',
                        invoices: [{ id: 'inv_de' }],
                    },
                ],
            } as unknown as InvoicePreview);
            await loaded;

            expect(invoicePreview.value).toEqual({ id: 'inv_de' });
        });

        // A superseded preview hands over only once it settles; one that never answers never does.
        it('moves on to a later preview past one that never answers', async () => {
            const pending: ((preview: InvoicePreview) => void)[] = [];
            mockGetInvoicePreview.mockImplementation(
                () => new Promise((resolve) => pending.push(resolve)),
            );
            const { loadInvoicePreview, whenLoaded } = useInvoicePreview();

            void loadInvoicePreview({ subscription, customer: individualCustomer('NL') });
            let isLoaded = false;
            void whenLoaded().then(() => (isLoaded = true));
            void loadInvoicePreview({ subscription, customer: individualCustomer('DE') });
            pending[1]!({
                first_invoice: { id: 'inv_de' },
                invoice_infos: [
                    {
                        pricing_plan_schedule_id: 'default_schedule_id',
                        invoices: [{ id: 'inv_de' }],
                    },
                ],
            } as unknown as InvoicePreview);
            await flushPromises();

            expect(isLoaded).toBe(true);
        });

        it('reports a preview that failed', async () => {
            mockGetInvoicePreview.mockRejectedValueOnce(new Error('Boom'));
            const { loadInvoicePreview, whenLoaded, isFailed } = useInvoicePreview();

            await expect(loadInvoicePreview({ subscription })).rejects.toThrow('Boom');

            expect(isFailed.value).toBe(true);
            await expect(whenLoaded()).rejects.toThrow('Boom');
        });
    });
});
