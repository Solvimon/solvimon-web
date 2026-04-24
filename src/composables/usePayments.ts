import { createPaymentsService } from '@/services/payments';
import { useService } from '@/composables/useService';

export function usePayments() {
    const { getPayments } = createPaymentsService();
    const { data, execute: get, error, apiStatus, isPending } = useService({
        service: getPayments,
        isCollection: true,
    });

    return { payments: data, get, error, apiStatus, isPending };
}
