import type { Invoice } from '@solvimon/solvimon-types';
import { createInvoicesService } from './invoices';
import { isRejectedPromotionCode } from './apiError';

const { mockRequest, mockDownloadFile } = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockDownloadFile: vi.fn(),
}));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@solvimon/solvimon-ui', async () => ({
    ...(await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui')),
    downloadFile: mockDownloadFile,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { transaction: 'https://api.test' } }),
}));

describe('invoices service', () => {
    describe('getInvoicePdf', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockRequest.mockResolvedValue(new Blob(['pdf']));
        });

        it('asks for the PDF of the given invoice', async () => {
            const { getInvoicePdf } = createInvoicesService();
            await getInvoicePdf({ id: 'inv_123', invoice_number: 'INV-001' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/invoices/inv_123/pdf',
                options: { headers: { Accept: 'application/pdf', 'Content-Type': null } },
            });
        });

        it('names the file after the invoice number the customer reads on the document', async () => {
            const { getInvoicePdf } = createInvoicesService();
            await getInvoicePdf({ id: 'inv_123', invoice_number: 'INV-001' });

            expect(mockDownloadFile).toHaveBeenCalledWith(expect.any(Blob), 'invoice-INV-001.pdf');
        });

        it('falls back to the id for an invoice that has no number yet', async () => {
            const { getInvoicePdf } = createInvoicesService();
            await getInvoicePdf({ id: 'inv_123', invoice_number: '' as Invoice['invoice_number'] });

            expect(mockDownloadFile).toHaveBeenCalledWith(expect.any(Blob), 'invoice-inv_123.pdf');
        });
    });

    describe('getInvoice', () => {
        beforeEach(() => vi.clearAllMocks());

        it('asks for the invoice by id, encoded as one path segment', async () => {
            await createInvoicesService().getInvoice('inv/../1' as Invoice['id']);

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/invoices/inv%2F..%2F1',
            });
        });
    });

    describe('getInvoices', () => {
        beforeEach(() => vi.clearAllMocks());

        it("lists the customer's invoices a page at a time, with any extra filter", async () => {
            await createInvoicesService().getInvoices({
                customerId: 'cus_1',
                pagination: { page: 2, pageSize: 5 },
                query: { status: 'OPEN' },
            });

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.test/portal/invoices',
                    isCollection: true,
                    query: expect.objectContaining({ customer_id: 'cus_1', status: 'OPEN' }),
                }),
            );
        });
    });

    describe('getInvoicePreview', () => {
        const customer = { type: 'INDIVIDUAL' as const };

        beforeEach(() => vi.clearAllMocks());

        const sentData = () =>
            (mockRequest.mock.calls[0][0] as { data: Record<string, unknown> }).data;

        it('prices a subscription not created yet off its template, for the details given', async () => {
            await createInvoicesService().getInvoicePreview({
                customer,
                pricingPlanSubscriptionId: 'ppsu_1',
            } as never);

            expect(sentData()).toEqual({
                template_pricing_plan_subscription_id: 'ppsu_1',
                customer_details: { ...customer, reference: 'preview' },
            });
        });

        it('prices a running subscription as itself, without customer details', async () => {
            await createInvoicesService().getInvoicePreview({
                customer,
                pricingPlanSubscriptionId: 'ppsu_1',
                forExistingSubscription: true,
                startAt: '2026-11-01',
            } as never);

            expect(sentData()).toEqual({
                pricing_plan_subscription_id: 'ppsu_1',
                start_at: '2026-11-01',
            });
        });

        // A code the API turns down is the customer's typo, not an SDK failure to log as one.
        it('treats a rejected promotion code as an expected answer', async () => {
            await createInvoicesService().getInvoicePreview({
                customer,
                pricingPlanSubscriptionId: 'ppsu_1',
            } as never);

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.test/portal/invoices/preview',
                    options: { method: 'POST', isExpectedError: isRejectedPromotionCode },
                }),
            );
        });
    });

    describe('on-demand pricing items', () => {
        const url = 'https://api.test/portal/invoices/charge-on-demand-pricing-items';
        const pricingItems = [{ pricing_item_id: 'pit_1', number: '2' }];

        beforeEach(() => vi.clearAllMocks());

        it('previews an order without creating anything', async () => {
            await createInvoicesService().previewChargeOnDemandPricingItems({
                pricingPlanScheduleId: 'ppsc_1',
                pricingItems,
            } as never);

            expect(mockRequest).toHaveBeenCalledWith({
                url,
                options: { method: 'POST' },
                data: {
                    pricing_plan_schedule_id: 'ppsc_1',
                    pricing_items: pricingItems,
                    preview: true,
                },
            });
        });

        it('finalises the invoice of a placed order unless told otherwise', async () => {
            const service = createInvoicesService();
            await service.chargeOnDemandPricingItems({
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_items: pricingItems,
            } as never);
            await service.chargeOnDemandPricingItems({
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_items: pricingItems,
                finalize_immediately: false,
            } as never);

            const finalized = mockRequest.mock.calls.map(
                ([call]) =>
                    (call as { data: { finalize_immediately: boolean } }).data.finalize_immediately,
            );
            expect(finalized).toEqual([true, false]);
        });
    });

    describe('getChangePlanInvoicePreview', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockRequest.mockResolvedValue({ id: 'invo_preview' });
        });

        it('previews the move with what change-plan takes, plus the subscription', async () => {
            const { getChangePlanInvoicePreview } = createInvoicesService();
            const response = await getChangePlanInvoicePreview({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/invoices/change-plan/preview',
                options: { method: 'POST' },
                data: { pricing_plan_subscription_id: 'ppsu_1', pricing_plan_id: 'ppla_pro' },
            });
            expect(response).toEqual({ id: 'invo_preview' });
        });
    });
});
