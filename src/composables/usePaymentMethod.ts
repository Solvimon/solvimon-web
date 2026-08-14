import type { Customer, PaymentMethod } from '@solvimon/solvimon-types';
import { getPaginatedFullList, isApiSuccessCollectionResponse } from '@solvimon/solvimon-ui';
import { shallowRef } from 'vue';
import { createPaymentMethodsService } from '@/services/paymentMethods';

const PAGE_SIZE = 50;

/**
 * One of a customer's stored payment methods, picked out by id — a subscription's
 * `payment_method_id`, for instance.
 *
 * The customer's methods are listed and then matched locally rather than fetched one by one, so the
 * whole set is walked (every page, not just the first) before deciding the id is not among them.
 */
export function usePaymentMethod(): {
    paymentMethod: ReturnType<typeof shallowRef<PaymentMethod | undefined>>;
    get: (args: {
        customerId: Customer['id'];
        paymentMethodId: PaymentMethod['id'];
    }) => Promise<PaymentMethod | undefined>;
} {
    const { getPaymentMethods } = createPaymentMethodsService();

    const paymentMethod = shallowRef<PaymentMethod | undefined>();

    const get = async ({
        customerId,
        paymentMethodId,
    }: {
        customerId: Customer['id'];
        paymentMethodId: PaymentMethod['id'];
    }) => {
        const response = await getPaginatedFullList<PaymentMethod>(async (page) => {
            const pageResponse = await getPaymentMethods({
                customerId,
                pagination: { page, pageSize: PAGE_SIZE },
            });

            if (!isApiSuccessCollectionResponse(pageResponse)) {
                throw new Error('Could not load the customer’s payment methods.');
            }

            return pageResponse;
        });

        paymentMethod.value = response.data.find(({ id }) => id === paymentMethodId);

        return paymentMethod.value;
    };

    return { paymentMethod, get };
}
