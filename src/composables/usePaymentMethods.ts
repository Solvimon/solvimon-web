import type { PaymentMethod } from '@solvimon/types';
import { useIncrementalLoading } from './useIncrementalLoading';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export function usePaymentMethods({
    customerId,
    pageSize = 15,
}: {
    customerId: string;
    pageSize?: number;
}) {
    const { getPaymentMethods } = createPaymentMethodsService();

    const service = async (page: number) =>
        getPaymentMethods({
            customerId,
            pagination: { page, pageSize },
        });

    return useIncrementalLoading<PaymentMethod>({ service });
}
