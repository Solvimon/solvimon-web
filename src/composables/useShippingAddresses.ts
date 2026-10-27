import type { Customer } from '@solvimon/solvimon-types';
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createShippingAddressesService } from '@/services/shippingAddresses';
import type { CreateShippingAddressPayload, ShippingAddress } from '@/types/shippingAddress';

export interface UseShippingAddresses {
    items: Ref<ShippingAddress[]>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    fetchAll: () => Promise<void>;
    /** Stores an address, ready for use, and reloads the list so it shows up there. */
    create: (payload: CreateShippingAddressPayload) => Promise<ShippingAddress>;
    /**
     * Edits an address. An ACTIVE address cannot be changed, so the edit is stored as a new active
     * address and the old one is retired.
     * `progress` records how far it got, so calling it again after a failure carries on from there,
     * with any change made to the form since saved onto the new address.
     */
    replace: (
        address: ShippingAddress,
        payload: CreateShippingAddressPayload,
        progress: ShippingAddressReplacement,
    ) => Promise<ShippingAddress>;
    remove: (address: ShippingAddress) => Promise<void>;
}

/** How far replacing an address got. Start with an empty object and keep it for a retry. */
export interface ShippingAddressReplacement {
    /** The new address, stored and active. */
    replacement?: ShippingAddress;
    /** What the new address was stored with, to tell whether the form changed since. */
    storedDetails?: string;
}

/** The details an address is stored with, apart from its reference, which every save makes anew. */
const detailsOf = ({ reference: _reference, ...details }: CreateShippingAddressPayload) =>
    JSON.stringify(details);

/** Newest first, with the default leading: the order the customer picks between them in. */
const byDefaultThenNewest = (a: ShippingAddress, b: ShippingAddress) =>
    Number(b.is_default) - Number(a.is_default) ||
    (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0);

/**
 * The shipping addresses stored for a customer. A change is followed by a reload rather than patched
 * into the list, which is what the API holds afterwards.
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

    const fetchAll = async () => {
        const id = toValue(customerId);

        if (!id) return;

        isPending.value = true;
        error.value = undefined;

        try {
            const response = await service.getShippingAddresses({ customerId: id });
            // The request asks for ACTIVE ones, but the portal is not known to apply that filter,
            // and the list must never offer a draft or a retired address.
            items.value = response.data
                .filter(({ status }) => status === 'ACTIVE')
                .sort(byDefaultThenNewest);
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

    /**
     * A customer adding an address means to use it, so it is stored ACTIVE. Left to the API, it
     * would be a DRAFT, which the list leaves out and cannot be the default, and the portal cannot
     * activate it afterwards.
     */
    const storeActive = (payload: CreateShippingAddressPayload) =>
        service.createShippingAddress({ ...payload, status: 'ACTIVE' });

    const create = async (payload: CreateShippingAddressPayload) => {
        try {
            return await storeActive(payload);
        } finally {
            await fetchAll();
        }
    };

    const replace = async (
        address: ShippingAddress,
        payload: CreateShippingAddressPayload,
        progress: ShippingAddressReplacement,
    ) => {
        try {
            if (!progress.replacement) {
                progress.replacement = await storeActive(payload);
                progress.storedDetails = detailsOf(payload);
            } else if (progress.storedDetails !== detailsOf(payload)) {
                // Still new, so no order ships to it yet and it can take the correction in place.
                progress.replacement = await service.updateShippingAddress({
                    shippingAddressId: progress.replacement.id,
                    payload: { ...payload, reference: progress.replacement.reference },
                });
                progress.storedDetails = detailsOf(payload);
            }

            await service.deleteShippingAddress({ shippingAddressId: address.id });

            return progress.replacement;
        } finally {
            await fetchAll();
        }
    };

    const remove = async (address: ShippingAddress) => {
        await service.deleteShippingAddress({ shippingAddressId: address.id });
        await fetchAll();
    };

    return {
        items,
        isPending,
        error,
        fetchAll,
        create,
        replace,
        remove,
    };
}
