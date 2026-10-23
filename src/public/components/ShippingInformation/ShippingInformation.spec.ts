import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import ShippingInformation from './ShippingInformation.vue';
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
        props: { showModal: Boolean, customer: Object, addresses: Array, actions: Object },
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
    });
});

const customer = { id: 'cust_1', type: 'INDIVIDUAL' } as unknown as Customer;

const homeAddress = {
    id: 'shad_home',
    is_default: true,
    recipient: {
        type: 'INDIVIDUAL',
        individual: { name: { last_name: 'Lovelace' } },
        phone_number: '',
    },
    address: { line1: 'Damrak 1', city: 'Amsterdam', country: 'NL' },
} as unknown as ShippingAddress;

const mountComponent = ({
    addresses = [homeAddress],
    error,
    isLoading = false,
    withCustomer = true,
}: {
    addresses?: ShippingAddress[];
    error?: unknown;
    isLoading?: boolean;
    withCustomer?: boolean;
} = {}) => {
    const items = ref(addresses);
    mockUseShippingAddresses.mockReturnValue({
        items,
        defaultAddress: computed(() => items.value.find(({ is_default }) => is_default)),
        isPending: ref(false),
        error: ref(error),
        fetchAll: mockFetchAll,
        create: vi.fn(),
        remove: vi.fn(),
        setDefault: vi.fn(),
    });

    return mount(ShippingInformation, {
        props: { customer: withCustomer ? customer : undefined, isLoading },
    });
};

describe('ShippingInformation', () => {
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

    it('shows the default shipping address under its title', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Shipping information');
        expect(wrapper.find('.sv-shipping-information__default').text()).toContain('Damrak 1');
    });

    it('says so when there is no default address yet', () => {
        const wrapper = mountComponent({ addresses: [] });

        expect(wrapper.find('.sv-shipping-information__empty').text()).toBe(
            'No default shipping address yet.',
        );
    });

    it('says so when the addresses cannot be loaded', () => {
        const wrapper = mountComponent({ error: new Error('down') });

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
    });

    it('opens the addresses from the manage button, and not before', async () => {
        const wrapper = mountComponent();

        expect(wrapper.findComponent({ name: 'ShippingAddressesModal' }).exists()).toBe(false);

        await wrapper.find('.sv-shipping-information__manage').trigger('click');
        await flushPromises();

        const modal = wrapper.findComponent({ name: 'ShippingAddressesModal' });
        expect(modal.props('showModal')).toBe(true);
        expect(modal.props('addresses')).toEqual([homeAddress]);
    });

    it('closes the addresses again', async () => {
        const wrapper = mountComponent();
        await wrapper.find('.sv-shipping-information__manage').trigger('click');
        await flushPromises();

        wrapper.findComponent({ name: 'ShippingAddressesModal' }).vm.$emit('close');
        await flushPromises();

        expect(wrapper.findComponent({ name: 'ShippingAddressesModal' }).props('showModal')).toBe(
            false,
        );
    });
});
