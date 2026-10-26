import type { Customer } from '@solvimon/solvimon-types';
import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createShippingAddressesService } from '@/services/shippingAddresses';
import type {
    CreateShippingAddressPayload,
    ShippingAddress,
    UpdateShippingAddressPayload,
} from '@/types/shippingAddress';

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
    update: (address: ShippingAddress, payload: UpdateShippingAddressPayload) => Promise<void>;
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
    const create = async (payload: CreateShippingAddressPayload, draft?: ShippingAddress) => {
        const stored = draft
            ? await service.updateShippingAddress({ shippingAddressId: draft.id, payload })
            : await service.createShippingAddress(payload);

        try {
            return stored.status === 'DRAFT'
                ? await service.activateShippingAddress({ shippingAddressId: stored.id })
                : stored;
        } catch (cause) {
            throw new ShippingAddressNotActivatedError(stored, { cause });
        } finally {
            await fetchAll();
        }
    };

    const update = async (address: ShippingAddress, payload: UpdateShippingAddressPayload) => {
        await service.updateShippingAddress({ shippingAddressId: address.id, payload });
        await fetchAll();
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
        update,
        remove,
        setDefault,
    };
}
