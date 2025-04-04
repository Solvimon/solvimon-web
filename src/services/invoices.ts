import type { Invoice } from '@solvimon/types';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';
import { request } from '@/utils/request';

/**
 * Get a single invoice
 */
export function getInvoice(invoiceId: Invoice['id']) {
    const config = useConfig();

    return request<Invoice>({
        endpoint: `${config.apiUrls.transaction}/portal/invoices/${invoiceId}`,
    });
}
