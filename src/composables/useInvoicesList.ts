import type { Customer, Invoice } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from '@/composables/useIncrementalLoading';
import { createInvoicesService } from '@/services/invoices';

/** The SDK's documented maximum for `pagination.batchSize`; the API itself allows more. */
export const MAX_INVOICES_BATCH_SIZE = 50;

const DEFAULT_INVOICES_BATCH_SIZE = 15;

export function useInvoicesList({
    customerId,
    batchSize = DEFAULT_INVOICES_BATCH_SIZE,
}: {
    customerId: Customer['id'];
    batchSize: number;
}) {
    const invoicesService = createInvoicesService();
    // A host calling from plain JavaScript can pass anything, such as a string.
    const requested = Number.isFinite(batchSize) ? batchSize : DEFAULT_INVOICES_BATCH_SIZE;
    const pageSize = Math.min(MAX_INVOICES_BATCH_SIZE, Math.max(1, Math.floor(requested)));

    const service = async (page: number) =>
        invoicesService.getInvoices({
            customerId,
            pagination: { page, pageSize },
        });

    return useIncrementalLoading<Invoice>({ service });
}
