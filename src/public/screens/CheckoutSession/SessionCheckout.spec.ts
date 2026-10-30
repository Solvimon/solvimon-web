import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import SessionCheckout from './SessionCheckout.vue';

const { session } = vi.hoisted(() => ({
    session: {
        endState: undefined as string | undefined,
        isRedirecting: false,
        loadFailure: undefined as object | undefined,
    },
}));

vi.mock('./useCheckoutSession', () => ({
    useCheckoutSession: () => ({
        source: {},
        endState: ref(session.endState),
        isRedirecting: ref(session.isRedirecting),
        loadFailure: ref(session.loadFailure),
    }),
}));

vi.mock('@/public/screens/Checkout/Checkout.vue', () => ({
    default: defineComponent({
        name: 'CheckoutStub',
        setup: () => () => h('div', { class: 'checkout' }),
    }),
}));

const mountScreen = () => mount(SessionCheckout, { props: { portalUrlId: 'purl_1' } });

describe('SessionCheckout', () => {
    beforeEach(() => {
        session.endState = undefined;
        session.isRedirecting = false;
        session.loadFailure = undefined;
    });

    it('renders the checkout while the session is open', () => {
        session.endState = undefined;

        expect(mountScreen().find('.checkout').exists()).toBe(true);
    });

    it.each([
        ['COMPLETED', true, 'This checkout has been completed', 'Taking you back…'],
        ['COMPLETED', false, 'This checkout has been completed', undefined],
        ['FAILED', false, 'We received your payment', 'We are finishing your account.'],
        ['PROCESSING', false, 'We are processing your payment', 'You do not need to pay again.'],
        ['CLOSED', false, 'This checkout is closed', undefined],
    ])(
        'shows a %s session (redirecting: %s) as ended, without the checkout',
        (endState, isRedirecting, title, message) => {
            session.endState = endState;
            session.isRedirecting = isRedirecting;

            const wrapper = mountScreen();

            expect(wrapper.find('.checkout').exists()).toBe(false);
            expect(wrapper.text()).toContain(title);
            if (message) expect(wrapper.text()).toContain(message);
            expect(wrapper.find('button').exists()).toBe(false);
        },
    );

    it('announces that it is taking the customer back', () => {
        session.endState = 'COMPLETED';
        session.isRedirecting = true;

        expect(mountScreen().find('[role="status"]').text()).toBe('Taking you back…');
    });

    it('says the checkout is not available when the session could not be read', () => {
        session.loadFailure = {};

        const wrapper = mountScreen();

        expect(wrapper.find('.checkout').exists()).toBe(false);
        expect(wrapper.text()).toContain('Checkout not available');
    });

    it('says how the link ended when reading the session found it ended', () => {
        session.loadFailure = { reason: 'expired' };

        const wrapper = mountScreen();

        expect(wrapper.find('.checkout').exists()).toBe(false);
        expect(wrapper.text()).toContain('This checkout link has expired');
    });
});
