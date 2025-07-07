import type { Customer, Invoice, PricingPlanSubscription } from '@solvimon/types';
import { downloadFile } from '@solvimon/ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createInvoicesService() {
    const request = createRequestService();
    const config = useConfig();

    /**
     * Get a single invoice
     */
    function getInvoice(invoiceId: Invoice['id']) {
        return request<Invoice>({
            url: `${config.apiUrls.transaction}/portal/invoices/${invoiceId}`,
        });
    }

    /**
     * Download the PDF version of the invoice.
     */
    async function getInvoicePdf(id: string) {
        return request<Blob>({
            url: `${config.apiUrls.transaction}/portal/invoices/${id}/pdf`,
            options: {
                headers: { 'Content-Type': 'application/pdf' },
            },
        }).then((response) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const newBlob = new Blob([response as BlobPart], {
                type: 'application/pdf',
            });
            downloadFile(newBlob, `invoice-${id}.pdf`);
        });
    }

    /**
     * Get a preview of the invoice
     */
    function getInvoicePreview({
        customer,
        pricingPlanSubscriptionId,
    }: {
        customer: Partial<Customer>;
        pricingPlanSubscriptionId: PricingPlanSubscription['id'];
    }) {
        return request<{ invoice: Invoice }>({
            url: `${config.apiUrls.transaction}/portal/invoices/preview`,
            options: {
                method: 'POST',
            },
            data: {
                template_pricing_plan_subscription_id: pricingPlanSubscriptionId,
                customer_details: {
                    ...customer,
                    reference: 'preview',
                },
            },
        });
    }

    return {
        getInvoice,
        getInvoicePdf,
        getInvoicePreview,
    };
}
