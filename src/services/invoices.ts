import type { Invoice } from '@solvimon/types';
import { request } from '../utils/request';
import { useConfig } from '../components/ConfigProvider/composables/useConfig';

/**
 * Get a single invoice
 */
export function getInvoice(invoiceId: Invoice['id']) {
    const config = useConfig();

    return request<Invoice>({
        endpoint: `${config.apiUrls.transaction}/portal/invoices/${invoiceId}`
    });
};