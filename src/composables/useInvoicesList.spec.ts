import { useInvoicesList } from './useInvoicesList';

const { mockGetInvoices } = vi.hoisted(() => ({ mockGetInvoices: vi.fn() }));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoices: mockGetInvoices }),
}));

describe('useInvoicesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInvoices.mockResolvedValue({ data: [], links: {} });
    });

    const requestedPageSize = async (batchSize: number) => {
        await useInvoicesList({ customerId: 'cus_123', batchSize }).fetchInitial();

        return mockGetInvoices.mock.lastCall?.[0].pagination.pageSize;
    };

    it('asks for the batch size it is given', async () => {
        expect(await requestedPageSize(20)).toBe(20);
    });

    it('asks for no more than the 50 invoices the API returns in one page', async () => {
        expect(await requestedPageSize(500)).toBe(50);
    });

    it('asks for at least one invoice', async () => {
        expect(await requestedPageSize(-3)).toBe(1);
    });

    it('asks for a whole number of invoices', async () => {
        expect(await requestedPageSize(12.7)).toBe(12);
    });
});
