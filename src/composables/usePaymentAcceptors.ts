import type {
    Customer,
    PaymentAcceptor,
    PaymentAcceptorPatchPayload,
    PaymentAcceptorPayload,
} from '@solvimon/solvimon-types';
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createPaymentAcceptorsService } from '@/services/paymentAcceptors';
import type { SolvimonPaymentAcceptorChangedDetail } from '@/public/core/events.types';

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
    /** Stores a bank account and adds the server-confirmed result to the list. */
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
 * The payment acceptors of a customer: the bank accounts a self-billing customer is paid into.
 */
export function usePaymentAcceptors({
    customerId,
    onChanged,
}: {
    /** Read on every load, so a host can hand it over before the customer has arrived. */
    customerId: MaybeRefOrGetter<Customer['id'] | undefined>;
    onChanged?: (detail: Omit<SolvimonPaymentAcceptorChangedDetail, 'componentName'>) => void;
}): UsePaymentAcceptors {
    const service = createPaymentAcceptorsService();
    const logger = useLogger();

    const items = ref<PaymentAcceptor[]>([]);
    const isPending = ref(false);
    const error = ref<unknown>();
    let latestLoad = 0;
    let loadedFor: string | undefined;

    const fetchAll = async () => {
        const id = toValue(customerId);
        const load = ++latestLoad;
        if (id !== loadedFor) {
            loadedFor = id;
            items.value = [];
        }
        if (!id) {
            isPending.value = false;
            error.value = undefined;
            return;
        }

        const isCurrent = () => load === latestLoad && id === toValue(customerId);

        isPending.value = true;
        error.value = undefined;

        try {
            const response = await service.getPaymentAcceptors({ customerId: id });
            if (isCurrent()) items.value = [...response.data].sort(byActiveFirst);
        } catch (loadError) {
            if (!isCurrent()) return;
            logger.error(
                'PAYMENT_ACCEPTORS_LOAD_FAILED',
                'Failed to load the payment acceptors',
                {},
                loadError,
            );
            error.value = loadError;
        } finally {
            if (isCurrent()) isPending.value = false;
        }
    };

    const applyChange = (id: string | undefined, acceptor: PaymentAcceptor, archived = false) => {
        if (id !== toValue(customerId)) return;

        // A read started before the write could still return the old list.
        latestLoad++;
        isPending.value = false;
        const index = items.value.findIndex((item) => item.id === acceptor.id);
        if (archived || acceptor.status === 'ARCHIVED') {
            items.value = items.value.filter((item) => item.id !== acceptor.id);
        } else if (index === -1) {
            items.value = [...items.value, acceptor].sort(byActiveFirst);
        } else {
            items.value = items.value
                .map((item) => (item.id === acceptor.id ? acceptor : item))
                .sort(byActiveFirst);
        }
    };

    const create = async (details: PaymentAcceptorCreateDetails) => {
        const id = toValue(customerId);
        if (!id) throw new Error('Payment acceptors require a customer');
        const saved = await service.createPaymentAcceptor({ ...details, customer_id: id });
        applyChange(id, saved);
        onChanged?.({ operation: 'created', customerId: id, paymentAcceptorId: saved.id });
        return saved;
    };

    const update = async (
        paymentAcceptor: PaymentAcceptor,
        payload: PaymentAcceptorPatchPayload,
    ) => {
        const id = toValue(customerId);
        if (!id) throw new Error('Payment acceptors require a customer');
        const saved = await service.updatePaymentAcceptor({
            paymentAcceptorId: paymentAcceptor.id,
            payload,
        });
        applyChange(id, saved);
        onChanged?.({ operation: 'updated', customerId: id, paymentAcceptorId: saved.id });
        return saved;
    };

    const remove = async (paymentAcceptor: PaymentAcceptor) => {
        const id = toValue(customerId);
        if (!id) throw new Error('Payment acceptors require a customer');
        await service.archivePaymentAcceptor({ paymentAcceptorId: paymentAcceptor.id });
        applyChange(id, paymentAcceptor, true);
        onChanged?.({
            operation: 'archived',
            customerId: id,
            paymentAcceptorId: paymentAcceptor.id,
        });
    };

    return { items, isPending, error, fetchAll, create, update, remove };
}
