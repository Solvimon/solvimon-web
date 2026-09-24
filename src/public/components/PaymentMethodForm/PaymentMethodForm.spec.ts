import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import PaymentMethodForm from './PaymentMethodForm.vue';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSafeUrlRedirect, mockIntegrationSubmit } = vi.hoisted(() => ({
    mockSafeUrlRedirect: vi.fn(),
    mockIntegrationSubmit: vi.fn(),
}));

vi.mock('@/utils/url', async () => ({
    ...(await vi.importActual<typeof import('@/utils/url')>('@/utils/url')),
    safeUrlRedirect: mockSafeUrlRedirect,
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

// Nothing provides it outside an entry component, and the form is mounted on its own here.
vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    async () => {
        const { ref } = await import('vue');
        return { useExperimentalFeature: () => ref(null) };
    },
);

// Starts up Adyen and Stripe, which is not what this form is about. Stubbed down to the two things
// the form talks to it through: a submit handle, and the outcome it reports back.
vi.mock('@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue', async () => {
    const { defineComponent, h } = await import('vue');

    return {
        default: defineComponent({
            name: 'PaymentIntegrationFormStub',
            emits: ['select', 'payment-success', 'payment-failed', 'ready'],
            setup(_props, { expose }) {
                expose({ submit: mockIntegrationSubmit });

                return () => h('div', { 'data-testid': 'payment-integration-form' });
            },
        }),
    };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER = {
    id: 'cus_123',
    type: 'INDIVIDUAL',
    individual: {
        name: { first_name: 'John', last_name: 'Doe' },
        residential_address: { country: 'NL' },
    },
} as unknown as Customer;

const SUCCESS_REDIRECT_URL = 'https://merchant.example/payment-methods';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountForm = (props: Record<string, unknown> = {}) =>
    mount(PaymentMethodForm, {
        props: {
            customer: CUSTOMER,
            paymentMethodOptions: [createPaymentMethodOptionEntry()],
            ...props,
        },
    });

type Wrapper = ReturnType<typeof mountForm>;

const buttonLabels = (wrapper: Wrapper) => wrapper.findAll('button').map((button) => button.text());

/** Puts the form through, the way the gateway reports a stored method. */
const completeForm = async (wrapper: Wrapper) => {
    wrapper.findComponent({ name: 'PaymentIntegrationFormStub' }).vm.$emit('payment-success');
    await nextTick();
};

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('PaymentMethodForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('offers to save the payment method while there is one to save', () => {
        const wrapper = mountForm();

        expect(buttonLabels(wrapper)).toContain('Save payment method');
    });

    describe('once the payment method is stored', () => {
        it('stops offering a save that has nothing left to save', async () => {
            const wrapper = mountForm();

            await completeForm(wrapper);

            expect(buttonLabels(wrapper)).not.toContain('Save payment method');
        });

        it('reports the success to the host', async () => {
            const wrapper = mountForm();

            await completeForm(wrapper);

            expect(wrapper.emitted('success')).toHaveLength(1);
        });

        // Where "back" leads is the host's to know, so the form ends on the confirmation alone.
        it('offers nowhere to go when the host configured no destination', async () => {
            const wrapper = mountForm();

            await completeForm(wrapper);

            expect(wrapper.findAll('button')).toHaveLength(0);
        });

        it('offers the way onward the host configured', async () => {
            const wrapper = mountForm({
                configuration: { variant: 'TOKENIZE', successRedirectUrl: SUCCESS_REDIRECT_URL },
            });

            await completeForm(wrapper);

            expect(buttonLabels(wrapper)).toEqual(['Continue']);
        });

        it("takes the host's own wording for that button", async () => {
            const wrapper = mountForm({
                configuration: {
                    variant: 'TOKENIZE',
                    successRedirectUrl: SUCCESS_REDIRECT_URL,
                    successRedirectLabel: 'Back to payment methods',
                },
            });

            await completeForm(wrapper);

            expect(buttonLabels(wrapper)).toEqual(['Back to payment methods']);
        });

        // Leaving on its own would take away the confirmation before it has been read.
        it('stays put until the customer asks to leave', async () => {
            const wrapper = mountForm({
                configuration: { variant: 'TOKENIZE', successRedirectUrl: SUCCESS_REDIRECT_URL },
            });

            await completeForm(wrapper);

            expect(mockSafeUrlRedirect).not.toHaveBeenCalled();

            await wrapper.get('[data-testid="payment-method-form-continue"]').trigger('click');

            expect(mockSafeUrlRedirect).toHaveBeenCalledWith(SUCCESS_REDIRECT_URL);
        });

        // The footer is the host's, and so is whatever replaces its button.
        it('draws no button of its own for a host that hid the submit button', async () => {
            const wrapper = mountForm({
                hideSubmitButton: true,
                configuration: { variant: 'TOKENIZE', successRedirectUrl: SUCCESS_REDIRECT_URL },
            });

            await completeForm(wrapper);

            expect(wrapper.findAll('button')).toHaveLength(0);
        });

        it('tells a host driving its own footer that the form is through', async () => {
            const wrapper = mountForm({ hideSubmitButton: true });

            expect(wrapper.vm.isCompleted).toBe(false);

            await completeForm(wrapper);

            expect(wrapper.vm.isCompleted).toBe(true);
        });
    });

    describe('when the payment fails', () => {
        it('keeps the save button, so the customer can try again', async () => {
            const wrapper = mountForm();

            wrapper
                .findComponent({ name: 'PaymentIntegrationFormStub' })
                .vm.$emit('payment-failed', new Error('declined'));
            await nextTick();

            expect(buttonLabels(wrapper)).toContain('Save payment method');
        });
    });
});
