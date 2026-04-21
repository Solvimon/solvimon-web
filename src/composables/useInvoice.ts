import type { Invoice } from '@solvimon/types';
import { createInvoicesService } from '@/services/invoices';
import { useService } from '@/composables/useService';

export function useInvoice({ invoiceId }: { invoiceId: Invoice['id'] }) {
    const { getInvoice, getInvoicePdf: downloadInvoicePdf } = createInvoicesService();
    const service: () => ReturnType<typeof getInvoice> = () => getInvoice(invoiceId);
    const { data, fetch, apiStatus, error, isPending } = useService({
        service,
    });

    return {
        invoice: data,
        downloadInvoicePdf,
        apiStatus,
        error,
        fetch,
        isPending,
    };
}
