import type { Invoice } from '@solvimon/solvimon-types';
import { createInvoicesService } from '@/services/invoices';
import { createPaymentsService } from '@/services/payments';
import { useData } from '@/utils/useData';

export function useInvoiceData(invoiceId: Invoice['id']) {
    const { getInvoice } = createInvoicesService();
    const { getPayments } = createPaymentsService();

    return useData({
        getData: async () => {
            const [invoice, paymentAttempts] = await Promise.all([
                getInvoice(invoiceId),
                getPayments(invoiceId),
            ]);
            return { invoice, paymentAttempts };
        },
    });
}
