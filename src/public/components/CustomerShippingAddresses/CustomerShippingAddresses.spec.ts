import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import CustomerShippingAddresses from './CustomerShippingAddresses.vue';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockUseShippingAddresses, mockFetchAll } = vi.hoisted(() => ({
    mockUseShippingAddresses: vi.fn(),
    mockFetchAll: vi.fn(),
}));

vi.mock('@/composables/useShippingAddresses', () => ({
    useShippingAddresses: mockUseShippingAddresses,
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
    customerId,
}: {
    addresses?: ShippingAddress[];
    error?: unknown;
    isLoading?: boolean;
    withCustomer?: boolean;
    customerId?: string;
} = {}) => {
    const items = ref(addresses);
    mockUseShippingAddresses.mockReturnValue({
        items,
        defaultAddress: computed(() => items.value.find(({ is_default }) => is_default)),
        isPending: ref(false),
        error: ref(error),
        fetchAll: mockFetchAll,
        create: vi.fn(),
        replace: vi.fn(),
        remove: vi.fn(),
    });

    return mount(CustomerShippingAddresses, {
        props: { customer: withCustomer ? customer : undefined, customerId, isLoading },
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

    it('loads the addresses by the customer id before the customer itself has arrived', () => {
        mountComponent({ withCustomer: false, customerId: 'cust_1', isLoading: true });

        expect(mockFetchAll).toHaveBeenCalledTimes(1);
    });

    it('waits while the screen is loading', () => {
        const wrapper = mountComponent({ isLoading: true });

        expect(wrapper.find('.sv-loading').exists()).toBe(true);
    });

    it('is left out, rather than loading forever, when the customer cannot be loaded', () => {
        const wrapper = mountComponent({ withCustomer: false });

        expect(wrapper.find('.sv-loading').exists()).toBe(false);
        expect(wrapper.find('.sv-shipping-addresses').exists()).toBe(false);
    });

    it('loads nothing while it does not know whose addresses to load', () => {
        mountComponent({ withCustomer: false });

        expect(mockFetchAll).not.toHaveBeenCalled();
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

    it('says so when the addresses cannot be loaded', () => {
        const wrapper = mountComponent({ error: new Error('down') });

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
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

    it('closes the modal again', async () => {
        const wrapper = mountComponent();
        await wrapper.find('.sv-shipping-addresses__manage').trigger('click');
        await flushPromises();

        modal(wrapper).vm.$emit('close');
        await flushPromises();

        expect(modal(wrapper).props('showModal')).toBe(false);
    });
});
