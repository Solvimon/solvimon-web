import type { ApiSuccessCollectionResponse, Invoice, Payment } from '@solvimon/solvimon-types';
import { onMounted, ref, type Ref } from 'vue';
import { createInvoicesService } from '@/services/invoices';
import { createPaymentsService } from '@/services/payments';

type InvoiceData = { invoice: Invoice; paymentAttempts?: ApiSuccessCollectionResponse<Payment> };

/**
 * Payments are only fetched for a caller that shows them: fetched alongside the invoice, a failure
 * to load them would cost the invoice too. A failed request is logged by the request service and
 * leaves `data` empty once `isPending` turns false.
 */
export function useInvoiceData(
    invoiceId: Invoice['id'],
    { includePayments = false }: { includePayments?: boolean } = {},
): {
    data: Ref<InvoiceData | undefined>;
    isPending: Ref<boolean>;
} {
    const { getInvoice } = createInvoicesService();
    const { getPayments } = createPaymentsService();

    const data = ref<InvoiceData>();
    const isPending = ref(true);

    onMounted(async () => {
        try {
            const [invoice, paymentAttempts] = await Promise.all([
                getInvoice(invoiceId),
                includePayments ? getPayments(invoiceId) : undefined,
            ]);
            data.value = { invoice, paymentAttempts };
        } catch {
            // Logged by the request service; `data` stays empty.
        } finally {
            isPending.value = false;
        }
    });

    return { data, isPending };
}
