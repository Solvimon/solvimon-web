import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Customer, ShippingAddress } from '@solvimon/solvimon-types';
import ShippingAddressForm from './ShippingAddressForm.vue';

const { mockSubmit, mockDispatch, mockLogError } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    mockDispatch: vi.fn(),
    mockLogError: vi.fn(),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div role="alert">{{ title }}</div>',
        }),
    });
});

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLogError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/components/providers/HostElementProvider/composables/useHostEvent', () => ({
    useHostEvent: () => ({
        dispatch: mockDispatch,
        componentName: 'solvimon-shipping-address-form',
    }),
}));

vi.mock('@/components/customer/ShippingAddressForm/ShippingAddressForm.vue', () => ({
    default: defineComponent({
        name: 'InternalShippingAddressFormStub',
        setup: (_, { expose }) => expose({ submit: mockSubmit }),
        template: '<fieldset />',
    }),
}));

const customer = { id: 'cus_1', type: 'INDIVIDUAL' } as unknown as Customer;
const stored = { id: 'shad_old' } as ShippingAddress;
const payload = { customer_id: 'cus_1', reference: 'ref' };

const mountForm = (props: { address?: ShippingAddress; isAddressMissing?: boolean } = {}) => {
    const actions = {
        create: vi.fn().mockResolvedValue({ id: 'shad_new' }),
        replace: vi.fn().mockResolvedValue({ id: 'shad_replacement' }),
    };
    const wrapper = mount(ShippingAddressForm, { props: { customer, actions, ...props } });
    const save = async () => {
        await wrapper.find('form').trigger('submit');
        await flushPromises();
    };

    return { wrapper, actions, save };
};

describe('ShippingAddressForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmit.mockResolvedValue(payload);
    });

    it('adds a new address and tells the host which one it stored', async () => {
        const { wrapper, actions, save } = mountForm();

        expect(wrapper.find('h2').text()).toBe('Add shipping address');
        await save();

        expect(actions.create).toHaveBeenCalledExactlyOnceWith(payload);
        expect(mockDispatch).toHaveBeenCalledExactlyOnceWith('solvimon-shipping-address-saved', {
            componentName: 'solvimon-shipping-address-form',
            shippingAddressId: 'shad_new',
        });
    });

    it('stores an edit as a replacement of the address it was opened with', async () => {
        const { wrapper, actions, save } = mountForm({ address: stored });

        expect(wrapper.find('h2').text()).toBe('Edit shipping address');
        await save();

        expect(actions.replace).toHaveBeenCalledExactlyOnceWith(stored, payload, {});
        expect(actions.create).not.toHaveBeenCalled();
    });

    it('replaces the address it just added on a second save, rather than adding another', async () => {
        const { actions, save } = mountForm();

        await save();
        await save();

        expect(actions.create).toHaveBeenCalledOnce();
        expect(actions.replace).toHaveBeenCalledWith({ id: 'shad_new' }, payload, {});
    });

    it('stores nothing while the form has something to correct', async () => {
        mockSubmit.mockResolvedValue(undefined);
        const { actions, save } = mountForm();

        await save();

        expect(actions.create).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('says a save failed, logs it, and tells the host nothing', async () => {
        const failure = new Error('refused');
        const { wrapper, actions, save } = mountForm();
        actions.create.mockRejectedValue(failure);

        await save();

        expect(wrapper.find('[role="alert"]').text()).toBe(
            'Something went wrong. Please try again.',
        );
        expect(mockLogError).toHaveBeenCalledWith(
            'SHIPPING_ADDRESS_SAVE_FAILED',
            expect.any(String),
            {},
            failure,
        );
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('says so instead of showing a form for an address the customer does not have', () => {
        const { wrapper } = mountForm({ isAddressMissing: true });

        expect(wrapper.find('form').exists()).toBe(false);
        expect(wrapper.find('[role="alert"]').text()).toBe(
            'We could not find this shipping address.',
        );
    });
});
