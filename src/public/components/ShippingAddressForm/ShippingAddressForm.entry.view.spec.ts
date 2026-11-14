import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Customer, ShippingAddress } from '@solvimon/solvimon-types';
import ShippingAddressFormEntryView from './ShippingAddressForm.entry.view.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockFetchAll, items, loadError, lists } = vi.hoisted(() => ({
    mockFetchAll: vi.fn(),
    items: { value: [] as ShippingAddress[] },
    loadError: { value: undefined as unknown },
    lists: [] as { value: ShippingAddress[] }[],
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({
        customer: ref({ id: 'cus_1' } as Customer),
        get: { execute: vi.fn().mockResolvedValue({ id: 'cus_1' }) },
    }),
}));

vi.mock('@/composables/useShippingAddresses', async () => {
    const { ref } = await import('vue');
    return {
        useShippingAddresses: () => {
            const list = ref<ShippingAddress[]>([]);
            const error = ref<unknown>();
            lists.push(list);
            mockFetchAll.mockImplementation(async () => {
                list.value = items.value;
                error.value = loadError.value;
            });
            return {
                items: list,
                error,
                fetchAll: mockFetchAll,
                create: vi.fn(),
                replace: vi.fn(),
            };
        },
    };
});

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', async () => {
    const { providerMockLogger } = await import('@/test-utils/providerMock');
    return { useLogger: () => providerMockLogger };
});

const mountView = (shippingAddressId?: string) => {
    let slotProps: Record<string, unknown> = {};
    mount(ShippingAddressFormEntryView, {
        props: {
            environment: 'TEST',
            portalObject: createTestPortalObject('cus_1'),
            ...(shippingAddressId && { configuration: { shippingAddressId } }),
        },
        slots: {
            default: (props: Record<string, unknown>) => {
                slotProps = props;
                return '';
            },
        },
    });
    return () => slotProps;
};

describe('ShippingAddressForm entry view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        items.value = [{ id: 'shad_1' } as ShippingAddress];
        loadError.value = undefined;
        lists.length = 0;
    });

    it('loads no addresses to add a new one', async () => {
        const slotProps = mountView();
        await flushPromises();

        expect(mockFetchAll).not.toHaveBeenCalled();
        expect(slotProps()).toMatchObject({ address: undefined, isAddressMissing: false });
    });

    it('hands over the stored address to edit', async () => {
        const slotProps = mountView('shad_1');
        await flushPromises();

        expect(slotProps()).toMatchObject({
            address: { id: 'shad_1' },
            isAddressMissing: false,
            isLoading: false,
        });
    });

    it('flags an address the customer does not have', async () => {
        const slotProps = mountView('shad_unknown');
        await flushPromises();

        expect(slotProps()).toMatchObject({ address: undefined, isAddressMissing: true });
    });

    it('keeps the address it opened with once a save has replaced it in the list', async () => {
        const slotProps = mountView('shad_1');
        await flushPromises();

        // What the reload after a save holds: the replacement, not the address it replaced.
        lists[0].value = [{ id: 'shad_2' } as ShippingAddress];
        await flushPromises();

        expect(slotProps()).toMatchObject({ address: { id: 'shad_1' }, isAddressMissing: false });
    });

    it('says the addresses could not be loaded, rather than that the address is missing', async () => {
        loadError.value = new Error('Boom');
        const slotProps = mountView('shad_1');
        await flushPromises();

        expect(slotProps()).toMatchObject({ hasLoadFailed: true, isAddressMissing: false });
    });
});
