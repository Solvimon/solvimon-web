import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import CustomerShippingAddresses from './CustomerShippingAddresses.vue';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockUseShippingAddresses, mockFetchAll, mockLoggerError } = vi.hoisted(() => ({
    mockUseShippingAddresses: vi.fn(),
    mockFetchAll: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/composables/useShippingAddresses', () => ({
    useShippingAddresses: mockUseShippingAddresses,
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

// Loaded with `import()`, which only unwraps `default` from a module that says it is one.
vi.mock('@/components/customer/ShippingAddresses/ShippingAddressesModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'ShippingAddressesModal',
        props: {
            showModal: Boolean,
            start: Object,
            customer: Object,
            addresses: Array,
            actions: Object,
        },
        emits: ['close'],
        setup: () => () => h('div', { class: 'shipping-addresses-modal-stub' }),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
        ContextMenu: defineComponent({
            name: 'ContextMenuStub',
            props: { items: { type: Array, default: () => [] } },
            setup: (props) => () =>
                h(
                    'div',
                    { class: 'context-menu-stub' },
                    (props.items as { label: string; onClick: () => void }[]).map((item) =>
                        h(
                            'button',
                            { class: 'context-menu-stub__item', onClick: item.onClick },
                            item.label,
                        ),
                    ),
                ),
        }),
    });
});

const customer = { id: 'cust_1', type: 'INDIVIDUAL' } as unknown as Customer;

const address = (id: string, isDefault = false) =>
    ({
        id,
        is_default: isDefault,
        recipient: {
            type: 'INDIVIDUAL',
            individual: { name: { last_name: 'Lovelace' } },
            phone_number: '+31612345678',
        },
        address: { line1: `${id} street`, city: 'Amsterdam', country: 'NL' },
    }) as unknown as ShippingAddress;

const HOME = address('home', true);
const OFFICE = address('office');

const mountComponent = ({
    addresses = [HOME, OFFICE],
    error,
    isLoading = false,
    withCustomer = true,
    setDefault = vi.fn().mockResolvedValue(undefined),
}: {
    addresses?: ShippingAddress[];
    error?: unknown;
    isLoading?: boolean;
    withCustomer?: boolean;
    setDefault?: ReturnType<typeof vi.fn>;
} = {}) => {
    const items = ref(addresses);
    mockUseShippingAddresses.mockReturnValue({
        items,
        defaultAddress: computed(() => items.value.find(({ is_default }) => is_default)),
        isPending: ref(false),
        error: ref(error),
        fetchAll: mockFetchAll,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        setDefault,
    });

    return mount(CustomerShippingAddresses, {
        props: { customer: withCustomer ? customer : undefined, isLoading },
    });
};

const items = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findAll('.sv-shipping-address-list__item');

const menuItem = (wrapper: ReturnType<typeof mountComponent>, index: number, label: string) =>
    items(wrapper)
        [index].findAll('.context-menu-stub__item')
        .find((item) => item.text() === label)!;

const modal = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findComponent({ name: 'ShippingAddressesModal' });

describe('CustomerShippingAddresses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads the customer's addresses", () => {
        mountComponent();

        expect(mockFetchAll).toHaveBeenCalledTimes(1);
    });

    it('waits for the customer before loading anything', () => {
        const wrapper = mountComponent({ withCustomer: false });

        expect(mockFetchAll).not.toHaveBeenCalled();
        expect(wrapper.find('.sv-loading').exists()).toBe(true);
    });

    it('lists the addresses under one title, marking the default', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Shipping addresses');
        expect(items(wrapper)).toHaveLength(2);
        expect(items(wrapper)[0].text()).toContain('home street');
        expect(items(wrapper)[0].find('.sv-shipping-address__default').exists()).toBe(true);
        expect(items(wrapper)[1].find('.sv-shipping-address__default').exists()).toBe(false);
    });

    it('names a single address in the singular', () => {
        const wrapper = mountComponent({ addresses: [HOME] });

        expect(wrapper.text()).toContain('Shipping address');
        expect(wrapper.text()).not.toContain('Shipping addresses');
    });

    it('shows only the address lines, leaving the recipient to the modal', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-shipping-address__recipient').exists()).toBe(false);
        expect(wrapper.find('.sv-shipping-address__phone').exists()).toBe(false);
    });

    it('shows the first three, leaving the rest to the modal', () => {
        const wrapper = mountComponent({
            addresses: [HOME, OFFICE, address('shop'), address('depot')],
        });

        expect(items(wrapper)).toHaveLength(3);
    });

    it('offers to add a first address when there are none', async () => {
        const wrapper = mountComponent({ addresses: [] });

        expect(wrapper.find('.sv-shipping-addresses__empty').exists()).toBe(true);

        await wrapper.find('.sv-shipping-addresses__add').trigger('click');
        await flushPromises();

        expect(modal(wrapper).props('start')).toEqual({ step: 'ADD' });
        expect(modal(wrapper).props('showModal')).toBe(true);
    });

    it('says so when the addresses cannot be loaded', () => {
        const wrapper = mountComponent({ error: new Error('down') });

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
    });

    it('opens the modal on the list from the manage button, and not before', async () => {
        const wrapper = mountComponent();

        expect(modal(wrapper).exists()).toBe(false);

        await wrapper.find('.sv-shipping-addresses__manage').trigger('click');
        await flushPromises();

        expect(modal(wrapper).props('showModal')).toBe(true);
        expect(modal(wrapper).props('start')).toEqual({ step: 'LIST' });
        expect(modal(wrapper).props('addresses')).toEqual([HOME, OFFICE]);
    });

    it.each([
        ['Edit', 'EDIT'],
        ['Delete', 'DELETE'],
    ] as const)('opens the modal on %s for the address whose menu it is', async (label, step) => {
        const wrapper = mountComponent();

        await menuItem(wrapper, 1, label).trigger('click');
        await flushPromises();

        expect(modal(wrapper).props('showModal')).toBe(true);
        expect(modal(wrapper).props('start')).toEqual({ step, address: OFFICE });
    });

    it('sets an address as the default from its menu, without opening the modal', async () => {
        const setDefault = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ setDefault });

        await menuItem(wrapper, 1, 'Set as default').trigger('click');
        await flushPromises();

        expect(setDefault).toHaveBeenCalledWith(OFFICE);
        expect(modal(wrapper).exists()).toBe(false);
    });

    it('says so and logs it when an address cannot be made the default', async () => {
        const failure = new Error('nope');
        const wrapper = mountComponent({ setDefault: vi.fn().mockRejectedValue(failure) });

        await menuItem(wrapper, 1, 'Set as default').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SHIPPING_ADDRESS_SET_DEFAULT_FAILED',
            'Failed to set the default shipping address',
            {},
            failure,
        );
    });

    it('closes the modal again', async () => {
        const wrapper = mountComponent();
        await wrapper.find('.sv-shipping-addresses__manage').trigger('click');
        await flushPromises();

        modal(wrapper).vm.$emit('close');
        await flushPromises();

        expect(modal(wrapper).props('showModal')).toBe(false);
    });
});
