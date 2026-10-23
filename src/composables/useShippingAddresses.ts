import type { Customer } from '@solvimon/solvimon-types';
import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createShippingAddressesService } from '@/services/shippingAddresses';
import type { CreateShippingAddressPayload, ShippingAddress } from '@/types/shippingAddress';

export interface UseShippingAddresses {
    items: Ref<ShippingAddress[]>;
    /** The customer's default address, or undefined while they have none. */
    defaultAddress: ComputedRef<ShippingAddress | undefined>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    fetchAll: () => Promise<void>;
    /** Stores an address and reloads the list, so it shows up where the customer expects it. */
    create: (payload: CreateShippingAddressPayload) => Promise<ShippingAddress>;
    remove: (address: ShippingAddress) => Promise<void>;
    setDefault: (address: ShippingAddress) => Promise<void>;
}

/** Newest first, with the default leading: the order the customer picks between them in. */
const byDefaultThenNewest = (a: ShippingAddress, b: ShippingAddress) =>
    Number(b.is_default) - Number(a.is_default) ||
    (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0);

/**
 * The shipping addresses stored for a customer. A change is followed by a reload rather than patched
 * into the list, since setting a default also clears the previous one.
 */
export function useShippingAddresses({
    customerId,
}: {
    /** Read on every load, so a host can hand it over before the customer has arrived. */
    customerId: MaybeRefOrGetter<Customer['id'] | undefined>;
}): UseShippingAddresses {
    const service = createShippingAddressesService();
    const logger = useLogger();

    const items = ref<ShippingAddress[]>([]);
    const isPending = ref(false);
    const error = ref<unknown>();

    const defaultAddress = computed(() => items.value.find(({ is_default }) => is_default));

    const fetchAll = async () => {
        const id = toValue(customerId);

        if (!id) return;

        isPending.value = true;
        error.value = undefined;

        try {
            const response = await service.getShippingAddresses({ customerId: id });
            items.value = [...response.data].sort(byDefaultThenNewest);
        } catch (loadError) {
            logger.error(
                'SHIPPING_ADDRESSES_LOAD_FAILED',
                'Failed to load the shipping addresses',
                {},
                loadError,
            );
            error.value = loadError;
        } finally {
            isPending.value = false;
        }
    };

    const create = async (payload: CreateShippingAddressPayload) => {
        const created = await service.createShippingAddress(payload);
        await fetchAll();
        return created;
    };

    const remove = async (address: ShippingAddress) => {
        await service.deleteShippingAddress({ shippingAddressId: address.id });
        await fetchAll();
    };

    const setDefault = async (address: ShippingAddress) => {
        await service.setDefaultShippingAddress({ shippingAddressId: address.id });
        await fetchAll();
    };

    return { items, defaultAddress, isPending, error, fetchAll, create, remove, setDefault };
}
