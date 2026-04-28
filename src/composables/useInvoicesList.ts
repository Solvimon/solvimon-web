import type { Customer, Invoice } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from '@/composables/useIncrementalLoading';
import { createInvoicesService } from '@/services/invoices';

export function useInvoicesList({
    customerId,
    batchSize: pageSize = 15,
}: {
    customerId: Customer['id'];
    batchSize: number;
}) {
    const invoicesService = createInvoicesService();

    const service = async (page: number) =>
        invoicesService.getInvoices({
            customerId,
            pagination: { page, pageSize },
        });

    return useIncrementalLoading<Invoice>({ service });
}
