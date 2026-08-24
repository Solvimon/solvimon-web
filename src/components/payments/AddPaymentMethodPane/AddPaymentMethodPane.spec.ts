import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { Ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import AddPaymentMethodPane from './AddPaymentMethodPane.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSubmit, gateway } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    /** Stands in for the payment gateway's own state, which the form owns. */
    gateway: {} as { isPaymentPending: Ref<boolean> },
}));

// Starts up the Adyen and Stripe integrations, which are not what this pane is about. Stubbed so the
// handle the pane drives it through — submit, and whether a request is out — can be steered.
vi.mock('@/public/components/PaymentMethodForm/PaymentMethodForm.vue', async () => {
    const { defineComponent, h, ref } = await import('vue');

    return {
        default: defineComponent({
            name: 'PaymentMethodFormStub',
            props: {
                customer: { type: Object, default: undefined },
                paymentMethodOptions: { type: Array, default: undefined },
                isLoading: { type: Boolean, default: false },
                configuration: { type: Object, default: undefined },
                hideSubmitButton: { type: Boolean, default: false },
            },
            emits: ['success', 'failure'],
            setup(_props, { expose }) {
                // A ref, as the real form's is, so what the pane reports off it stays reactive.
                gateway.isPaymentPending = ref(false);

                expose({ submit: mockSubmit, isPaymentPending: gateway.isPaymentPending });

                return () => h('div', { 'data-testid': 'payment-method-form' });
            },
        }),
    };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER = { id: 'cust_1' } as Customer;

/** One way to pay, as the gateway answers with it. What it holds is the form's business, not this. */
const PAYMENT_METHOD_OPTIONS = [
    { payment_acceptor: 'pacc_1', integration: 'ADYEN', options: [{ type: 'card' }] },
] as unknown as PaymentMethodOptionsResponse;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountPane = async (props: Record<string, unknown> = {}) => {
    const wrapper = mount(AddPaymentMethodPane, {
        props: { customer: CUSTOMER, paymentMethodOptions: PAYMENT_METHOD_OPTIONS, ...props },
    });

    await flushPromises();

    return wrapper;
};

type Wrapper = Awaited<ReturnType<typeof mountPane>>;

const form = (wrapper: Wrapper) => wrapper.find('[data-testid="payment-method-form"]');

const formStub = (wrapper: Wrapper) => wrapper.findComponent({ name: 'PaymentMethodFormStub' });

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('AddPaymentMethodPane', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    // The form starts up a payment gateway, so a customer who never comes here never pays for one.
    it('builds nothing until the pane is first shown', async () => {
        const wrapper = await mountPane({ isActive: false });

        expect(form(wrapper).exists()).toBe(false);

        await wrapper.setProps({ isActive: true });
        await flushPromises();

        expect(form(wrapper).exists()).toBe(true);
    });

    it('keeps the form once built, so stepping away and back does not start over', async () => {
        const wrapper = await mountPane({ isActive: true });

        await wrapper.setProps({ isActive: false });

        expect(form(wrapper).exists()).toBe(true);
    });

    it('builds nothing without a customer to store the method for', async () => {
        expect(form(await mountPane({ isActive: true, customer: undefined })).exists()).toBe(false);
    });

    // The method is stored for later rather than paid with now, which is a different flow entirely.
    it('runs the tokenization flow', async () => {
        const wrapper = await mountPane({ isActive: true });

        expect(formStub(wrapper).props('configuration')).toEqual({ variant: 'TOKENIZE' });
        expect(formStub(wrapper).props('hideSubmitButton')).toBe(true);
    });

    it('submits the form for a host whose own chrome owns the button', async () => {
        const wrapper = await mountPane({ isActive: true });

        wrapper.vm.submit();

        expect(mockSubmit).toHaveBeenCalled();
    });

    it('reports the gateway working, so the host can show it', async () => {
        const wrapper = await mountPane({ isActive: true });

        expect(wrapper.vm.isSaving).toBe(false);

        gateway.isPaymentPending.value = true;

        expect(wrapper.vm.isSaving).toBe(true);
    });

    // A form left behind on a pane nobody is looking at is not what the host is waiting for.
    it('reports nothing pending once the host has moved on', async () => {
        const wrapper = await mountPane({ isActive: true });
        gateway.isPaymentPending.value = true;

        await wrapper.setProps({ isActive: false });

        expect(wrapper.vm.isSaving).toBe(false);
    });

    it('passes on what the form reports', async () => {
        const wrapper = await mountPane({ isActive: true });

        await formStub(wrapper).vm.$emit('success');
        await formStub(wrapper).vm.$emit('failure', new Error('declined'));

        expect(wrapper.emitted('success')).toHaveLength(1);
        expect(wrapper.emitted('failure')?.[0]).toEqual([new Error('declined')]);
    });
});
