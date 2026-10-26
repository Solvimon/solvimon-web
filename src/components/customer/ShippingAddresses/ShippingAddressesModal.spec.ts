import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import ShippingAddressesModal from './ShippingAddressesModal.vue';
import type { ShippingAddressesModalStart } from './ShippingAddressesModal.types';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockSubmit, mockLoggerError } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

// Validates and builds the address itself; its own spec covers that.
vi.mock('@/components/customer/ShippingAddressForm/ShippingAddressForm.vue', () => ({
    default: defineComponent({
        name: 'ShippingAddressForm',
        props: { customer: Object, address: Object, disabled: Boolean },
        setup(_, { expose }) {
            expose({ submit: mockSubmit });
            return () => h('div', { class: 'shipping-address-form-stub' });
        },
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Modal: defineComponent({
            name: 'ModalStub',
            props: {
                showModal: Boolean,
                title: String,
                confirmButtonText: String,
                cancelButtonText: String,
                isLoading: Boolean,
            },
            emits: ['confirm', 'close'],
            setup:
                (props, { slots, emit }) =>
                () =>
                    props.showModal
                        ? h('div', { class: 'modal' }, [
                              h('h1', { class: 'modal__title' }, props.title),
                              h('div', { class: 'modal__body' }, slots.body?.()),
                              ...(slots.footer
                                  ? [h('div', { class: 'modal__footer' }, slots.footer())]
                                  : [
                                        h(
                                            'button',
                                            {
                                                class: 'modal__confirm',
                                                onClick: () => emit('confirm'),
                                            },
                                            props.confirmButtonText ?? 'Confirm',
                                        ),
                                        h(
                                            'button',
                                            {
                                                class: 'modal__cancel',
                                                onClick: () => emit('close'),
                                            },
                                            props.cancelButtonText,
                                        ),
                                    ]),
                          ])
                        : null,
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
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
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
            individual: { name: { last_name: id } },
            phone_number: '',
        },
        address: { line1: `${id} street`, country: 'NL' },
    }) as unknown as ShippingAddress;

const mountComponent = (actions = {}, start?: ShippingAddressesModalStart) =>
    mount(ShippingAddressesModal, {
        props: {
            showModal: true,
            customer,
            addresses: [address('home', true), address('office')],
            start,
            actions: {
                create: vi.fn().mockResolvedValue(address('new')),
                replace: vi.fn().mockResolvedValue(address('new')),
                remove: vi.fn().mockResolvedValue(undefined),
                setDefault: vi.fn().mockResolvedValue(undefined),
                ...actions,
            },
        },
    });

const menuItem = (wrapper: ReturnType<typeof mountComponent>, index: number, label: string) =>
    wrapper
        .findAll('.sv-shipping-address-list__item')
        [index].findAll('.context-menu-stub__item')
        .find((item) => item.text() === label)!;

const title = (wrapper: ReturnType<typeof mountComponent>) => wrapper.find('.modal__title').text();

describe('ShippingAddressesModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("lists the customer's addresses, marking the default", () => {
        const wrapper = mountComponent();

        expect(title(wrapper)).toBe('Shipping addresses');
        expect(wrapper.findAll('.sv-shipping-address-list__item')).toHaveLength(2);
        expect(wrapper.findAll('.sv-shipping-address__default')).toHaveLength(1);
        expect(wrapper.find('.sv-shipping-addresses-modal__add').text()).toBe(
            'Add shipping address',
        );
    });

    it('offers to set an address as the default only when it is not already', () => {
        const wrapper = mountComponent();
        const [home, office] = wrapper.findAll('.sv-shipping-address-list__item');

        expect(home.text()).not.toContain('Set as default');
        expect(office.text()).toContain('Set as default');
        expect(home.text()).toContain('Edit');
        expect(home.text()).toContain('Delete');
    });

    it('sets the address as the default from its menu', async () => {
        const setDefault = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ setDefault });

        await menuItem(wrapper, 1, 'Set as default').trigger('click');
        await flushPromises();

        expect(setDefault).toHaveBeenCalledWith(expect.objectContaining({ id: 'office' }));
    });

    it('asks before deleting, and deletes once confirmed', async () => {
        const remove = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ remove });

        await menuItem(wrapper, 1, 'Delete').trigger('click');

        expect(title(wrapper)).toBe('Delete shipping address');
        expect(remove).not.toHaveBeenCalled();

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'office' }));
        expect(title(wrapper)).toBe('Shipping addresses');
    });

    it('goes back to the list without deleting when the customer thinks better of it', async () => {
        const remove = vi.fn();
        const wrapper = mountComponent({ remove });

        await menuItem(wrapper, 1, 'Delete').trigger('click');
        await wrapper.find('.modal__cancel').trigger('click');

        expect(title(wrapper)).toBe('Shipping addresses');
        expect(remove).not.toHaveBeenCalled();
    });

    it('moves to the form to add an address', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');

        expect(title(wrapper)).toBe('Add shipping address');
        expect(wrapper.find('.modal__confirm').text()).toBe('Save address');
        expect(wrapper.find('.modal__cancel').text()).toBe('Back');
    });

    it('stores the address and goes back to the list, which has reloaded with it', async () => {
        const payload = { customer_id: 'cust_1', reference: 'ref' };
        mockSubmit.mockResolvedValue(payload);
        const create = vi.fn().mockResolvedValue(address('new'));
        const wrapper = mountComponent({ create });

        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(create).toHaveBeenCalledWith(payload);
        expect(title(wrapper)).toBe('Shipping addresses');
    });

    it('stores nothing while the form says something is missing', async () => {
        mockSubmit.mockResolvedValue(undefined);
        const create = vi.fn();
        const wrapper = mountComponent({ create });

        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(create).not.toHaveBeenCalled();
        expect(title(wrapper)).toBe('Add shipping address');
    });

    it('stays on the form and says so when the address cannot be stored', async () => {
        mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
        const failure = new Error('nope');
        const wrapper = mountComponent({ create: vi.fn().mockRejectedValue(failure) });

        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(title(wrapper)).toBe('Add shipping address');
        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SHIPPING_ADDRESS_SAVE_FAILED',
            'Failed to save the shipping address',
            {},
            failure,
        );
    });

    it('closes from the list, which has nothing to confirm', async () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.modal__confirm').exists()).toBe(false);

        await wrapper.find('.sv-shipping-addresses-modal__close').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('steps back to the list rather than closing from the form', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
        expect(title(wrapper)).toBe('Shipping addresses');
    });

    it('says so when the customer has no addresses yet', () => {
        const wrapper = mount(ShippingAddressesModal, {
            props: {
                showModal: true,
                customer,
                addresses: [],
                actions: {
                    create: vi.fn(),
                    replace: vi.fn(),
                    remove: vi.fn(),
                    setDefault: vi.fn(),
                },
            },
        });

        expect(wrapper.find('.sv-shipping-addresses-modal__empty').exists()).toBe(true);
    });

    it('saves an edit as a replacement for the address, starting from what is stored', async () => {
        const payload = { customer_id: 'cust_1', reference: 'ref_new' };
        mockSubmit.mockResolvedValue(payload);
        const replace = vi.fn().mockResolvedValue(address('new'));
        const create = vi.fn();
        const wrapper = mountComponent({ replace, create });

        await menuItem(wrapper, 1, 'Edit').trigger('click');

        expect(title(wrapper)).toBe('Edit shipping address');
        expect(
            wrapper.findComponent({ name: 'ShippingAddressForm' }).props('address'),
        ).toMatchObject({ id: 'office' });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(replace).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'office' }),
            payload,
            {},
        );
        expect(create).not.toHaveBeenCalled();
        expect(title(wrapper)).toBe('Shipping addresses');
    });

    it('carries on with the same replacement when saving an edit again after a failure', async () => {
        mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
        const replace = vi
            .fn()
            .mockImplementationOnce(async (_, __, progress) => {
                progress.replacement = address('new');
                throw new Error('nope');
            })
            .mockResolvedValueOnce(address('new'));
        const wrapper = mountComponent({ replace });

        await menuItem(wrapper, 1, 'Edit').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(title(wrapper)).toBe('Edit shipping address');
        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(replace.mock.calls[1][2]).toEqual({
            replacement: expect.objectContaining({ id: 'new' }),
        });
        expect(title(wrapper)).toBe('Shipping addresses');
    });

    it('starts a fresh replacement for every edit', async () => {
        mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
        const replace = vi.fn().mockImplementation(async (_, __, progress) => {
            progress.replacement = address('new');
            throw new Error('nope');
        });
        const wrapper = mountComponent({ replace });

        await menuItem(wrapper, 1, 'Edit').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();
        await wrapper.find('.modal__cancel').trigger('click');
        await menuItem(wrapper, 0, 'Edit').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(replace.mock.calls[1][0]).toMatchObject({ id: 'home' });
        expect(replace.mock.calls[1][2]).not.toBe(replace.mock.calls[0][2]);
    });

    it('adds on an empty form, not on the address edited before', async () => {
        const wrapper = mountComponent();

        await menuItem(wrapper, 1, 'Edit').trigger('click');
        await wrapper.find('.modal__cancel').trigger('click');
        await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');

        expect(wrapper.findComponent({ name: 'ShippingAddressForm' }).props('address')).toBe(
            undefined,
        );
    });

    it('opened on one address, closes once it is saved instead of going on to the list', async () => {
        mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
        const office = address('office');
        const wrapper = mountComponent({}, { step: 'EDIT', address: office });

        expect(title(wrapper)).toBe('Edit shipping address');
        expect(wrapper.find('.modal__cancel').text()).toBe('Cancel');

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('opened on a delete, closes when the customer thinks better of it', async () => {
        const remove = vi.fn();
        const wrapper = mountComponent({ remove }, { step: 'DELETE', address: address('office') });

        expect(title(wrapper)).toBe('Delete shipping address');

        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
        expect(remove).not.toHaveBeenCalled();
    });

    it('opens on the list again after being opened on an address', async () => {
        const wrapper = mountComponent({}, { step: 'DELETE', address: address('office') });

        await wrapper.setProps({ showModal: false });
        await wrapper.setProps({ showModal: true, start: { step: 'LIST' } });

        expect(title(wrapper)).toBe('Shipping addresses');
        expect(wrapper.find('.sv-shipping-addresses-modal__close').text()).toBe('Close');
    });

    describe('making a new address the default', () => {
        const toggle = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.find<HTMLInputElement>(
                '.sv-shipping-addresses-modal__make-default input[type="checkbox"]',
            );

        it('is offered when adding, not when editing', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
            expect(toggle(wrapper).exists()).toBe(true);

            await wrapper.find('.modal__cancel').trigger('click');
            await menuItem(wrapper, 1, 'Edit').trigger('click');
            expect(toggle(wrapper).exists()).toBe(false);
        });

        it('starts off while the customer has addresses', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');

            expect(toggle(wrapper).element.checked).toBe(false);
        });

        it('starts off even when none of them is the default', async () => {
            const wrapper = mount(ShippingAddressesModal, {
                props: {
                    showModal: true,
                    customer,
                    addresses: [address('office')],
                    start: { step: 'ADD' },
                    actions: {
                        create: vi.fn(),
                        replace: vi.fn(),
                        remove: vi.fn(),
                        setDefault: vi.fn(),
                    },
                },
            });

            expect(toggle(wrapper).element.checked).toBe(false);
        });

        it("starts on for the customer's first address", async () => {
            const wrapper = mount(ShippingAddressesModal, {
                props: {
                    showModal: true,
                    customer,
                    addresses: [],
                    start: { step: 'ADD' },
                    actions: {
                        create: vi.fn(),
                        replace: vi.fn(),
                        remove: vi.fn(),
                        setDefault: vi.fn(),
                    },
                },
            });

            expect(toggle(wrapper).element.checked).toBe(true);
        });

        it('stores the address, then makes it the default when on', async () => {
            mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
            const created = address('new');
            const create = vi.fn().mockResolvedValue(created);
            const setDefault = vi.fn().mockResolvedValue(undefined);
            const wrapper = mountComponent({ create, setDefault });

            await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
            await toggle(wrapper).setValue(true);
            await wrapper.find('.modal__confirm').trigger('click');
            await flushPromises();

            expect(create).toHaveBeenCalled();
            expect(setDefault).toHaveBeenCalledWith(created);
            expect(create.mock.invocationCallOrder[0]).toBeLessThan(
                setDefault.mock.invocationCallOrder[0],
            );
            expect(title(wrapper)).toBe('Shipping addresses');
        });

        it('leaves the default alone when off', async () => {
            mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
            const setDefault = vi.fn();
            const wrapper = mountComponent({ setDefault });

            await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
            await wrapper.find('.modal__confirm').trigger('click');
            await flushPromises();

            expect(setDefault).not.toHaveBeenCalled();
        });

        it('says the address is saved but not the default when that part fails', async () => {
            mockSubmit.mockResolvedValue({ customer_id: 'cust_1' });
            const failure = new Error('nope');
            const create = vi.fn().mockResolvedValue(address('new'));
            const wrapper = mountComponent({
                create,
                setDefault: vi.fn().mockRejectedValue(failure),
            });

            await wrapper.find('.sv-shipping-addresses-modal__add').trigger('click');
            await toggle(wrapper).setValue(true);
            await wrapper.find('.modal__confirm').trigger('click');
            await flushPromises();

            expect(create).toHaveBeenCalledTimes(1);
            expect(title(wrapper)).toBe('Shipping addresses');
            expect(wrapper.find('.error-notification-stub').text()).toContain(
                'Your address is saved, but we could not make it your default.',
            );
            expect(mockLoggerError).toHaveBeenCalledWith(
                'SHIPPING_ADDRESS_SET_DEFAULT_FAILED',
                'Failed to set the default shipping address',
                {},
                failure,
            );
        });
    });
});
