import type { Payment } from '@solvimon/types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

const BASE_URL = '/portal/payments';

export const createPaymentsService = () => {
    const request = createRequestService();
    const config = useConfig();

    return {
        /**
         * Get payments
         */
        getPayments(invoiceId: string) {
            return request<Payment>({
                url: `${config.apiUrls.transaction}${BASE_URL}`,
                query: { invoice_id: invoiceId },
                isCollection: true,
            });
        },
    };
};
