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
    /**
     * Stores an address, puts it into use, and reloads the list, so it shows up where the customer
     * expects it. Given the draft a failed activation left behind, it saves onto that one instead
     * of storing another.
     */
    create: (
        payload: CreateShippingAddressPayload,
        draft?: ShippingAddress,
    ) => Promise<ShippingAddress>;
    /**
     * Edits an address. An ACTIVE address cannot be changed, so the edit is stored as a new active
     * address, which takes over as the default if the old one was, and the old one is retired.
     * `progress` records how far it got, so calling it again after a failure carries on from there.
     */
    replace: (
        address: ShippingAddress,
        payload: CreateShippingAddressPayload,
        progress: ShippingAddressReplacement,
    ) => Promise<ShippingAddress>;
    remove: (address: ShippingAddress) => Promise<void>;
    setDefault: (address: ShippingAddress) => Promise<void>;
}

/** The address was stored, but stayed a DRAFT: not listed, and not usable until activated. */
export class ShippingAddressNotActivatedError extends Error {
    constructor(
        readonly address: ShippingAddress,
        options?: ErrorOptions,
    ) {
        super('The shipping address was stored but not activated', options);
        this.name = 'ShippingAddressNotActivatedError';
    }
}

/** How far replacing an address got. Start with an empty object and keep it for a retry. */
export interface ShippingAddressReplacement {
    /** The new address, stored but not activated yet. */
    draft?: ShippingAddress;
    /** The new address, stored and active. */
    replacement?: ShippingAddress;
    /** Whether the default has moved over to the new address. */
    isDefaultMoved?: boolean;
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
            // Asked for already, but the list must never offer a draft or a retired address.
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
     * A customer adding an address means to use it. The API creates it as a DRAFT, which the list
     * leaves out and cannot be the default, so it is activated straight away.
     */
    const storeActive = async (payload: CreateShippingAddressPayload, draft?: ShippingAddress) => {
        const stored = draft
            ? await service.updateShippingAddress({ shippingAddressId: draft.id, payload })
            : await service.createShippingAddress(payload);

        if (stored.status !== 'DRAFT') return stored;

        try {
            return await service.activateShippingAddress({ shippingAddressId: stored.id });
        } catch (cause) {
            throw new ShippingAddressNotActivatedError(stored, { cause });
        }
    };

    const create = async (payload: CreateShippingAddressPayload, draft?: ShippingAddress) => {
        try {
            return await storeActive(payload, draft);
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
                try {
                    progress.replacement = await storeActive(payload, progress.draft);
                    progress.draft = undefined;
                } catch (storeError) {
                    if (storeError instanceof ShippingAddressNotActivatedError) {
                        progress.draft = storeError.address;
                    }
                    throw storeError;
                }
            }

            // Before the old address is retired, which clears its default flag.
            if (address.is_default && !progress.isDefaultMoved) {
                await service.setDefaultShippingAddress({
                    shippingAddressId: progress.replacement.id,
                });
                progress.isDefaultMoved = true;
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

    const setDefault = async (address: ShippingAddress) => {
        await service.setDefaultShippingAddress({ shippingAddressId: address.id });
        await fetchAll();
    };

    return {
        items,
        defaultAddress,
        isPending,
        error,
        fetchAll,
        create,
        replace,
        remove,
        setDefault,
    };
}
