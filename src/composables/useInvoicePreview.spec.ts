import type {
    Invoice,
    InvoicePreview,
    Pricing,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useInvoicePreview } from './useInvoicePreview';

const { mockGetInvoicePreview, convertDateRangeToTimePeriodMock } = vi.hoisted(() => ({
    mockGetInvoicePreview:
        vi.fn<
            (args: {
                pricingPlanSubscriptionId: PricingPlanSubscriptionExpanded['id'];
                startAt?: PricingPlanSchedule['start_at'];
                customizations?: PricingPlanScheduleCustomization[];
                customer: unknown;
            }) => Promise<InvoicePreview>
        >(),
    convertDateRangeToTimePeriodMock: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: vi.fn(() => ({
        getInvoicePreview: mockGetInvoicePreview,
    })),
}));

vi.mock('@solvimon/ui', () => ({
    convertDateRangeToTimePeriod: convertDateRangeToTimePeriodMock,
}));

describe('useInvoicePreview', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
        convertDateRangeToTimePeriodMock.mockReset();
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

        const checkoutForm = {
            type: 'ORGANIZATION',
            addressLine1: 'Main street 1',
            city: 'Amsterdam',
            postalCode: '1000AA',
            state: 'NH',
            companyLegalName: 'Acme Corp',
        } as unknown as CheckoutFormState;

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

        const mockedTrialPeriod = { start: '2024-01-01', end: '2024-01-10' };

        mockGetInvoicePreview.mockResolvedValue(invoicePreviewResponse);
        convertDateRangeToTimePeriodMock.mockReturnValue(mockedTrialPeriod);

        const { loadInvoicePreview, trialInvoicePreview, trialPeriod, invoicePreview } =
            useInvoicePreview();

        await loadInvoicePreview({
            subscription,
            subscriptionStartAt,
            checkoutForm,
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

        expect(convertDateRangeToTimePeriodMock).toHaveBeenCalledWith(
            new Date('2024-01-01T00:00:00.000Z'),
            new Date('2024-01-10T00:00:00.000Z'),
        );
        expect(trialInvoicePreview.value).toEqual(trialInvoice);
        expect(trialPeriod.value).toEqual(mockedTrialPeriod);
        expect(invoicePreview.value).toEqual(defaultInvoice);
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

        loadInvoicePreview({
            subscription,
            checkoutForm: { type: 'INDIVIDUAL', country: 'NL' } as CheckoutFormState,
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

        loadInvoicePreview({
            subscription,
            checkoutForm: { type: 'INDIVIDUAL', country: 'AU' } as CheckoutFormState,
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
            checkoutForm: { type: 'INDIVIDUAL', country: 'AU' } as CheckoutFormState,
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
            checkoutForm: { type: 'INDIVIDUAL', country: 'AU' } as CheckoutFormState,
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
            checkoutForm: { type: 'INDIVIDUAL', country: 'AU' } as CheckoutFormState,
            enabledPricingIds: ['pricing_1' as Pricing['id']],
        });

        const payload = mockGetInvoicePreview.mock.calls[0][0];
        const customization = payload.customizations?.[0];

        expect(customization?.pricing_currency).toBe('AUD');
        expect(customization).not.toHaveProperty('billing_period');
    });
});
