import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { PaymentAcceptor, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import CustomerPaymentAcceptors from './CustomerPaymentAcceptors.vue';
import type { CustomerPaymentAcceptorsProps } from './CustomerPaymentAcceptors.types';

const { acceptorsState, mockFetchAll, mockSetSubscriptionPaymentAcceptors } = vi.hoisted(() => ({
    acceptorsState: { items: [] as unknown[] },
    mockFetchAll: vi.fn(),
    mockSetSubscriptionPaymentAcceptors: vi.fn(),
}));

vi.mock('@/composables/usePaymentAcceptors', () => ({
    usePaymentAcceptors: () => ({
        items: ref(acceptorsState.items),
        isPending: ref(false),
        error: ref(undefined),
        fetchAll: mockFetchAll,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
    }),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({
        setSubscriptionPaymentAcceptors: mockSetSubscriptionPaymentAcceptors,
    }),
}));

// Loaded with `import()`, which only unwraps `default` from a module that says it is one.
vi.mock('@/components/payments/PaymentAcceptors/PaymentAcceptorsModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'PaymentAcceptorsModal',
        props: {
            showModal: Boolean,
            paymentAcceptors: Array,
            create: Function,
            subscription: Object,
            saveChoice: Function,
        },
        emits: ['close'],
        setup: () => () => h('div', { class: 'payment-acceptors-modal-stub' }),
    }),
}));

vi.mock('@/components/payments/PaymentAcceptors/PaymentAcceptorsManageModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'PaymentAcceptorsManageModal',
        props: { showModal: Boolean, start: String, paymentAcceptors: Array, actions: Object },
        emits: ['close'],
        setup: () => () => h('div', { class: 'payment-acceptors-manage-modal-stub' }),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        PaymentAcceptor: defineComponent({
            name: 'PaymentAcceptorStub',
            props: { paymentAcceptor: Object, options: Array },
            setup: (props) => () =>
                h(
                    'div',
                    { class: 'payment-acceptor-stub' },
                    (props.paymentAcceptor as PaymentAcceptor).id,
                ),
        }),
    });
});

const acceptor = (id: string, status: PaymentAcceptor['status'] = 'ACTIVE') =>
    ({ id, name: id, status, reference: id }) as unknown as PaymentAcceptor;

const subscription = (paymentAcceptorIds?: string[]) =>
    ({
        id: 'ppsu_1',
        customer_id: 'cust_1',
        variant: 'SELF_BILLING',
        payment_acceptor_ids: paymentAcceptorIds,
        billing_entity: { legal_name: 'Tivoli' },
    }) as unknown as PricingPlanSubscriptionExpanded;

const mountBlock = async (props: CustomerPaymentAcceptorsProps = { customerId: 'cust_1' }) => {
    const wrapper = mount(CustomerPaymentAcceptors, { props });
    await flushPromises();
    return wrapper;
};

const shownIds = (wrapper: Awaited<ReturnType<typeof mountBlock>>) =>
    wrapper.findAll('.payment-acceptor-stub').map((row) => row.text());

const manageModal = (wrapper: Awaited<ReturnType<typeof mountBlock>>) =>
    wrapper.findComponent({ name: 'PaymentAcceptorsManageModal' });

describe('CustomerPaymentAcceptors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        acceptorsState.items = [acceptor('a'), acceptor('b'), acceptor('c'), acceptor('d')];
    });

    it("loads the customer's acceptors", async () => {
        await mountBlock();

        expect(mockFetchAll).toHaveBeenCalled();
    });

    it('shows the first three and counts the rest', async () => {
        const wrapper = await mountBlock();

        expect(shownIds(wrapper)).toEqual(['a', 'b', 'c']);
        expect(wrapper.find('.sv-payment-acceptor-list__more').text()).toBe('+ 1 more');
    });

    it('shows as many as maxItems asks for', async () => {
        const wrapper = await mountBlock({ customerId: 'cust_1', maxItems: 10 });

        expect(shownIds(wrapper)).toEqual(['a', 'b', 'c', 'd']);
        expect(wrapper.find('.sv-payment-acceptor-list__more').exists()).toBe(false);
    });

    it('says it is where the customer receives payments', async () => {
        const wrapper = await mountBlock({ customerId: 'cust_1' });

        expect(wrapper.text()).toContain(
            'Where you receive payments for your self-billing subscriptions.',
        );
    });

    it('opens the management modal on its list from Manage', async () => {
        const wrapper = await mountBlock();

        await wrapper.find('.sv-payment-acceptors__manage').trigger('click');
        await flushPromises();

        expect(manageModal(wrapper).props('showModal')).toBe(true);
        expect(manageModal(wrapper).props('start')).toBe('LIST');
    });

    it('opens the management modal on adding from the empty state', async () => {
        acceptorsState.items = [];
        const wrapper = await mountBlock();

        expect(wrapper.find('.sv-payment-acceptors__manage').exists()).toBe(false);
        await wrapper.find('.sv-payment-acceptors__add').trigger('click');
        await flushPromises();

        expect(manageModal(wrapper).props('start')).toBe('ADD');
    });

    describe('for a subscription', () => {
        it('shows the acceptors linked to it', async () => {
            const wrapper = await mountBlock({ subscription: subscription(['b']) });

            expect(shownIds(wrapper)).toEqual(['b']);
            expect(wrapper.text()).toContain('Where you receive payments for this subscription.');
        });

        it('shows every active acceptor and says so when none is linked', async () => {
            acceptorsState.items = [acceptor('a'), acceptor('old', 'ARCHIVED')];
            const wrapper = await mountBlock({ subscription: subscription() });

            expect(shownIds(wrapper)).toEqual(['a']);
            expect(wrapper.text()).toContain('Where you receive payments for this subscription.');
        });

        it('offers no manage action while there is no payment acceptor to show', async () => {
            acceptorsState.items = [acceptor('old', 'ARCHIVED')];
            const wrapper = await mountBlock({ subscription: subscription() });

            expect(wrapper.find('.sv-payment-acceptors__manage').exists()).toBe(false);
            expect(wrapper.find('.sv-payment-acceptors__add').exists()).toBe(true);
        });

        it('chooses its acceptors, storing the choice on the subscription', async () => {
            mockSetSubscriptionPaymentAcceptors.mockResolvedValue({});
            const wrapper = await mountBlock({ subscription: subscription(['b']) });

            await wrapper.find('.sv-payment-acceptors__manage').trigger('click');
            await flushPromises();
            const modal = wrapper.findComponent({ name: 'PaymentAcceptorsModal' });
            expect(modal.props('subscription')).toEqual({
                id: 'ppsu_1',
                paymentAcceptorIds: ['b'],
                payerName: 'Tivoli',
            });

            await (modal.props('saveChoice') as (ids: string[]) => Promise<void>)(['a']);

            expect(mockSetSubscriptionPaymentAcceptors).toHaveBeenCalledWith({
                id: 'ppsu_1',
                paymentAcceptorIds: ['a'],
            });
            expect(wrapper.emitted('subscription-changed')).toHaveLength(1);
        });
    });
});
