import type { Invoice } from '@solvimon/types';
import { request } from '@/utils/request';
import { useConfig } from '../components/ConfigProvider/composables/useConfig';

/**
 * Get a single invoice
 */
export const getInvoice = (invoiceId: string): Promise<Invoice> => {
    const config = useConfig();
    return request(`${config.apiUrls.transaction}/portal/invoices/${invoiceId}`);
};