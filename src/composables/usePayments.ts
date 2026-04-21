import { createPaymentsService } from '@/services/payments';
import { useService } from '@/composables/useService';

export function usePayments() {
    const { getPayments } = createPaymentsService();
    const { data, fetch, error, apiStatus, isPending } = useService({
        service: getPayments,
        isCollection: true,
    });

    return { data, fetch, error, apiStatus, isPending };
}
