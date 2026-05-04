import type { ApiSuccessCollectionResponse, Invoice, Payment } from '@solvimon/solvimon-types';
import type { Ref } from 'vue';
import { createInvoicesService } from '@/services/invoices';
import { createPaymentsService } from '@/services/payments';
import { useData } from '@/utils/useData';

type InvoiceData = { invoice: Invoice; paymentAttempts: ApiSuccessCollectionResponse<Payment> };

export function useInvoiceData(invoiceId: Invoice['id']): { data: Ref<InvoiceData | undefined>; isPending: Ref<boolean> } {
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
