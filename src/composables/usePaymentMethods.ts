import type { PaymentMethod } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from './useIncrementalLoading';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export interface PaymentMethodsOrder {
    orderBy: 'created_at' | 'status' | 'type' | 'default';
    orderDirection: 'asc' | 'desc';
}

/** The customer's default method first, as the API sorts it. */
export const DEFAULT_PAYMENT_METHOD_FIRST: PaymentMethodsOrder = {
    orderBy: 'default',
    orderDirection: 'desc',
};

export function usePaymentMethods({
    customerId,
    pageSize = 15,
    order,
}: {
    customerId: string;
    pageSize?: number;
    order?: PaymentMethodsOrder;
}) {
    const { getPaymentMethods } = createPaymentMethodsService();

    const service = async (page: number) =>
        getPaymentMethods({
            customerId,
            pagination: { page, pageSize, ...order },
        });

    return useIncrementalLoading<PaymentMethod>({ service });
}
