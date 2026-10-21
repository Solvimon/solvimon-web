import type { Invoice } from '@solvimon/solvimon-types';
import { createInvoicesService } from './invoices';

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

        it('sends a billing period only when the customer moves to another one', async () => {
            const { getChangePlanInvoicePreview } = createInvoicesService();
            await getChangePlanInvoicePreview({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
                billingPeriod: { type: 'YEAR', value: 1 },
            });

            expect(mockRequest.mock.calls[0][0].data).toEqual({
                pricing_plan_subscription_id: 'ppsu_1',
                pricing_plan_id: 'ppla_pro',
                billing_period: { type: 'YEAR', value: 1 },
            });
        });
    });
});
