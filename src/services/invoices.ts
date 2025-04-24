import type { Invoice } from '@solvimon/types';
import { downloadFile } from '@solvimon/ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

export function createInvoicesService() {
    const request = createRequestService();
    const config = useConfig();

    return {
        /**
         * Get a single invoice
         */
        getInvoice(invoiceId: Invoice['id']) {
            return request<Invoice>({
                url: `${config.apiUrls.transaction}/portal/invoices/${invoiceId}`,
            });
        },

        /**
         * Download the PDF version of the invoice.
         */
        async getInvoicePdf(id: string) {
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
        },
    };
}
