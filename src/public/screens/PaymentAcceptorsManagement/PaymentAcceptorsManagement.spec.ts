import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorsManagement from './PaymentAcceptorsManagement.vue';

const { state, mockFetchAll, mockRemove, mockDispatchAction, mockLoggerError } = vi.hoisted(() => ({
    state: { items: [] as unknown[], error: undefined as unknown },
    mockFetchAll: vi.fn(),
    mockRemove: vi.fn(),
    mockDispatchAction: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/composables/usePaymentAcceptors', () => ({
    usePaymentAcceptors: () => ({
        items: ref(state.items),
        isPending: ref(false),
        error: ref(state.error),
        fetchAll: mockFetchAll,
        remove: mockRemove,
    }),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
    useLogger: () => ({ error: mockLoggerError }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Modal: defineComponent({
            name: 'ModalStub',
            props: { showModal: Boolean, title: String },
            emits: ['confirm', 'close'],
            setup:
                (props, { slots, emit }) =>
                () =>
                    props.showModal
                        ? h('div', { class: 'modal' }, [
                              h('div', slots.body?.()),
                              h('button', {
                                  class: 'modal__confirm',
                                  onClick: () => emit('confirm'),
                              }),
                          ])
                        : null,
        }),
        PaymentAcceptor: defineComponent({
            name: 'PaymentAcceptorStub',
            props: { paymentAcceptor: Object, options: Array },
            setup: (props) => () =>
                h('div', { class: 'payment-acceptor-stub' }, [
                    (props.paymentAcceptor as PaymentAcceptor).id,
                    ...((props.options ?? []) as { label: string; onClick: () => void }[]).map(
                        (item) =>
                            h('button', { class: 'menu-item', onClick: item.onClick }, item.label),
                    ),
                ]),
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
    });
});

const acceptor = (id: string) => ({ id, name: id, status: 'ACTIVE' }) as unknown as PaymentAcceptor;

const mountScreen = async () => {
    const wrapper = mount(PaymentAcceptorsManagement, { props: { customerId: 'cust_1' } });
    await flushPromises();
    return wrapper;
};

const menuItem = (wrapper: Awaited<ReturnType<typeof mountScreen>>, label: string) =>
    wrapper.findAll('.menu-item').find((item) => item.text() === label)!;

describe('PaymentAcceptorsManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchAll.mockResolvedValue(undefined);
        state.items = [acceptor('paya_1'), acceptor('paya_2')];
        state.error = undefined;
    });

    it('lists every acceptor of the customer', async () => {
        const wrapper = await mountScreen();

        expect(mockFetchAll).toHaveBeenCalled();
        expect(wrapper.findAll('.payment-acceptor-stub')).toHaveLength(2);
    });

    it('asks the host to add one', async () => {
        const wrapper = await mountScreen();

        await wrapper.find('.sv-payment-acceptors-management__add').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({ action: 'add-payment-acceptor' });
    });

    it('asks the host to edit one from its menu', async () => {
        const wrapper = await mountScreen();

        await menuItem(wrapper, 'Edit').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'edit-payment-acceptor',
            data: { paymentAcceptorId: 'paya_1' },
        });
    });

    it('deletes one once confirmed', async () => {
        mockRemove.mockResolvedValue(undefined);
        const wrapper = await mountScreen();

        await menuItem(wrapper, 'Delete').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(mockRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'paya_1' }));
        expect(wrapper.find('.modal').exists()).toBe(false);
    });

    it('keeps the confirmation open and says so when the delete fails', async () => {
        mockRemove.mockRejectedValue(new Error('down'));
        const wrapper = await mountScreen();

        await menuItem(wrapper, 'Delete').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.find('.modal .error-notification-stub').exists()).toBe(true);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'PAYMENT_ACCEPTOR_DELETE_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('says so when there are none yet', async () => {
        state.items = [];
        const wrapper = await mountScreen();

        expect(wrapper.text()).toContain('No payment acceptors yet');
    });

    it('says so when they cannot be loaded', async () => {
        state.error = new Error('down');
        const wrapper = await mountScreen();

        expect(wrapper.find('.sv-payment-acceptors-management__error').exists()).toBe(true);
    });
});
