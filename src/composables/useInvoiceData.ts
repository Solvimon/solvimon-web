import { createInvoicesService } from '@/services/invoices';
import { createPaymentsService } from '@/services/payments';
import { useData } from '@/utils/useData';

export function useInvoiceData(invoiceId: string) {
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
