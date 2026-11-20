import type {
    Customer,
    PaymentAcceptor,
    PaymentAcceptorPatchPayload,
    PaymentAcceptorPayload,
} from '@solvimon/solvimon-types';
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createPaymentAcceptorsService } from '@/services/paymentAcceptors';

/** What the customer fills in; the owner is added on create, and the portal makes the reference. */
export type PaymentAcceptorCreateDetails = Omit<
    PaymentAcceptorPayload,
    'reference' | 'customer_id'
>;

export interface UsePaymentAcceptors {
    items: Ref<PaymentAcceptor[]>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    fetchAll: () => Promise<void>;
    /** Stores a bank account for the customer and reloads the list so it shows up there. */
    create: (details: PaymentAcceptorCreateDetails) => Promise<PaymentAcceptor>;
    update: (
        paymentAcceptor: PaymentAcceptor,
        payload: PaymentAcceptorPatchPayload,
    ) => Promise<PaymentAcceptor>;
    remove: (paymentAcceptor: PaymentAcceptor) => Promise<void>;
}

/** Active ones first, each group in the order the API lists them. */
const byActiveFirst = (a: PaymentAcceptor, b: PaymentAcceptor) =>
    Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE');

/**
 * The payment acceptors of a customer: the bank accounts a self-billing customer is paid into. A
 * change is followed by a reload rather than patched into the list.
 */
export function usePaymentAcceptors({
    customerId,
}: {
    /** Read on every load, so a host can hand it over before the customer has arrived. */
    customerId: MaybeRefOrGetter<Customer['id'] | undefined>;
}): UsePaymentAcceptors {
    const service = createPaymentAcceptorsService();
    const logger = useLogger();

    const items = ref<PaymentAcceptor[]>([]);
    const isPending = ref(false);
    const error = ref<unknown>();

    const fetchAll = async () => {
        const id = toValue(customerId);

        if (!id) return;

        isPending.value = true;
        error.value = undefined;

        try {
            const response = await service.getPaymentAcceptors({ customerId: id });
            items.value = [...response.data].sort(byActiveFirst);
        } catch (loadError) {
            logger.error(
                'PAYMENT_ACCEPTORS_LOAD_FAILED',
                'Failed to load the payment acceptors',
                {},
                loadError,
            );
            error.value = loadError;
        } finally {
            isPending.value = false;
        }
    };

    const create = async (details: PaymentAcceptorCreateDetails) => {
        try {
            return await service.createPaymentAcceptor({
                ...details,
                customer_id: toValue(customerId),
            });
        } finally {
            await fetchAll();
        }
    };

    const update = async (
        paymentAcceptor: PaymentAcceptor,
        payload: PaymentAcceptorPatchPayload,
    ) => {
        try {
            return await service.updatePaymentAcceptor({
                paymentAcceptorId: paymentAcceptor.id,
                payload,
            });
        } finally {
            await fetchAll();
        }
    };

    const remove = async (paymentAcceptor: PaymentAcceptor) => {
        try {
            await service.deletePaymentAcceptor({ paymentAcceptorId: paymentAcceptor.id });
        } finally {
            await fetchAll();
        }
    };

    return { items, isPending, error, fetchAll, create, update, remove };
}
