import type { Customer, Invoice } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from '@/composables/useIncrementalLoading';
import { createInvoicesService } from '@/services/invoices';

/** The most invoices the API returns in one page. */
export const MAX_INVOICES_BATCH_SIZE = 50;

export function useInvoicesList({
    customerId,
    batchSize = 15,
}: {
    customerId: Customer['id'];
    batchSize: number;
}) {
    const invoicesService = createInvoicesService();
    const pageSize = Math.min(MAX_INVOICES_BATCH_SIZE, Math.max(1, Math.floor(batchSize)));

    const service = async (page: number) =>
        invoicesService.getInvoices({
            customerId,
            pagination: { page, pageSize },
        });

    return useIncrementalLoading<Invoice>({ service });
}
