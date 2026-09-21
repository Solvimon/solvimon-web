import type { Customer } from '@solvimon/solvimon-types';
import { flushPromises, mount } from '@vue/test-utils';
import PaymentMethodForm from './PaymentMethodForm.vue';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSubmit } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
}));

// Stands in for Adyen and Stripe, which mount a gateway's own drop-in. Stubbed down to the handle the
// form drives it through — submit — and the two results it can report back.
vi.mock('@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue', async () => {
    const { defineComponent, h } = await import('vue');

    return {
        default: defineComponent({
            name: 'PaymentIntegrationFormStub',
            emits: ['select', 'payment-success', 'payment-failed'],
            setup(_props, { expose }) {
                expose({ submit: mockSubmit });

                return () => h('div', { 'data-testid': 'payment-integration-form' });
            },
        }),
    };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER = {
    id: 'cust_1',
    type: 'INDIVIDUAL',
    individual: {
        name: { first_name: 'John', last_name: 'Doe' },
        residential_address: { country: 'NL' },
    },
} as unknown as Customer;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountForm = async (props: Record<string, unknown> = {}) => {
    const wrapper = mount(PaymentMethodForm, {
        props: {
            customer: CUSTOMER,
            paymentMethodOptions: [createPaymentMethodOptionEntry()],
            ...props,
        },
    });

    await flushPromises();

    return wrapper;
};

type Wrapper = Awaited<ReturnType<typeof mountForm>>;

const integrationForm = (wrapper: Wrapper) =>
    wrapper.findComponent({ name: 'PaymentIntegrationFormStub' });

const submitButton = (wrapper: Wrapper) => wrapper.get('button');

/** The drop-in is held behind these while the form is shut, so a click cannot reach it. */
const isIntegrationInert = (wrapper: Wrapper) =>
    wrapper.get('[data-testid="payment-integration-form"]').element.parentElement?.className ?? '';

const succeed = async (wrapper: Wrapper) => {
    await integrationForm(wrapper).vm.$emit('payment-success');
    await flushPromises();
};

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('PaymentMethodForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('submits the selected integration', async () => {
        const wrapper = await mountForm();

        await submitButton(wrapper).trigger('click');

        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    describe('once the payment method is stored', () => {
        it('stays shut, since the gateway has torn its drop-in down and a second submit reaches nothing', async () => {
            const wrapper = await mountForm();

            await submitButton(wrapper).trigger('click');
            await succeed(wrapper);

            expect(submitButton(wrapper).attributes('disabled')).toBeDefined();
            expect(isIntegrationInert(wrapper)).toContain('pointer-events-none');
        });

        it('ignores a submit a host asks for from its own chrome', async () => {
            const wrapper = await mountForm({ hideSubmitButton: true });

            wrapper.vm.submit();
            await succeed(wrapper);
            wrapper.vm.submit();

            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });

        it('reports the gateway as done, so a host holding its own button on it is released', async () => {
            const wrapper = await mountForm({ hideSubmitButton: true });

            wrapper.vm.submit();
            await succeed(wrapper);

            expect(wrapper.vm.isPaymentPending).toBe(false);
        });
    });

    describe('when the payment fails', () => {
        it('opens back up, so the customer can correct what they entered and try again', async () => {
            const wrapper = await mountForm();

            await submitButton(wrapper).trigger('click');
            await integrationForm(wrapper).vm.$emit('payment-failed', new Error('declined'));
            await flushPromises();

            expect(submitButton(wrapper).attributes('disabled')).toBeUndefined();
            expect(isIntegrationInert(wrapper)).not.toContain('pointer-events-none');

            // Through the exposed handler the button calls: the button's own double-click guard holds
            // a second click for half a second, which is not what is under test here.
            wrapper.vm.submit();

            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });
    });
});
