import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

        loadInvoicePreview({
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

        await Promise.resolve();

        expect(convertDateRangeToTimePeriodMock).toHaveBeenCalledWith(
            new Date('2024-01-01T00:00:00.000Z'),
            new Date('2024-01-10T00:00:00.000Z'),
        );
        expect(trialInvoicePreview.value).toEqual(trialInvoice);
        expect(trialPeriod.value).toEqual(mockedTrialPeriod);
        expect(invoicePreview.value).toEqual(defaultInvoice);
    });
});
