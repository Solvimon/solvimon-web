import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Customer, PaymentMethod } from '@solvimon/solvimon-types';
import PaymentMethodsModal from './PaymentMethodsModal.vue';
import type { PaymentMethodsModalStep } from './PaymentMethodsModal.types';

const { mockSubmit } = vi.hoisted(() => ({ mockSubmit: vi.fn() }));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

vi.mock('@/composables/useCustomerPaymentMethodOptions', async () => {
    const { ref } = await import('vue');
    return {
        useCustomerPaymentMethodOptions: () => ({
            settledOptions: ref([]),
            isPending: ref(false),
        }),
    };
});

vi.mock('@/components/payments/PaymentMethodsList/PaymentMethodsList.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodsListStub',
        emits: ['set-default', 'delete'],
        template: '<ul class="list-stub" />',
    }),
}));

vi.mock('@/components/payments/OnDemandPaymentModalShell/OnDemandPaymentModalShell.vue', () => ({
    default: defineComponent({
        name: 'OnDemandPaymentModalShellStub',
        props: {
            showModal: Boolean,
            step: String,
            title: String,
            cancelButtonText: String,
            confirmButtonText: String,
        },
        emits: ['confirm', 'cancel', 'payment-success', 'payment-failed'],
        setup: (_, { expose }) => expose({ submit: mockSubmit, isSaving: false }),
        template: `<div v-if="showModal" role="dialog" :data-step="step" :aria-label="title">
            <div v-if="step === 'LIST'"><slot name="LIST" /></div>
            <slot v-if="$slots.footer" name="footer" />
            <template v-else>
                <button data-testid="confirm" @click="$emit('confirm')">{{ confirmButtonText }}</button>
                <button data-testid="cancel" @click="$emit('cancel')">{{ cancelButtonText }}</button>
            </template>
        </div>`,
    }),
}));

const mountModal = (start?: PaymentMethodsModalStep) =>
    mount(PaymentMethodsModal, {
        props: {
            showModal: true,
            start,
            customer: { id: 'cus_1' } as Customer,
            paymentMethods: [{ id: 'pame_1' }] as PaymentMethod[],
        },
    });

const shell = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'OnDemandPaymentModalShellStub' });

describe('PaymentMethodsModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lists the payment methods, and closes from the list with one button', async () => {
        const wrapper = mountModal();

        expect(shell(wrapper).props('step')).toBe('LIST');
        expect(wrapper.find('.list-stub').exists()).toBe(true);
        expect(wrapper.find('[data-testid="confirm"]').exists()).toBe(false);

        await wrapper.find('.sv-payment-methods-modal__close').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('adds a method from the list, saving it from the footer, and goes back to the list', async () => {
        const wrapper = mountModal();

        await wrapper.find('.sv-payment-methods-modal__add').trigger('click');
        expect(shell(wrapper).props('step')).toBe('ADD_PAYMENT_METHOD');
        expect(wrapper.find('[data-testid="cancel"]').text()).toBe('Back');

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        expect(mockSubmit).toHaveBeenCalledOnce();

        shell(wrapper).vm.$emit('payment-success');
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('changed')).toHaveLength(1);
        expect(shell(wrapper).props('step')).toBe('LIST');
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('steps back to the list rather than closing while adding from it', async () => {
        const wrapper = mountModal();

        await wrapper.find('.sv-payment-methods-modal__add').trigger('click');
        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(shell(wrapper).props('step')).toBe('LIST');
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('closes once the method is stored, when it was opened just to add one', async () => {
        const wrapper = mountModal('ADD_PAYMENT_METHOD');

        expect(shell(wrapper).props('step')).toBe('ADD_PAYMENT_METHOD');
        expect(wrapper.find('[data-testid="cancel"]').text()).toBe('Close');

        shell(wrapper).vm.$emit('payment-success');

        expect(wrapper.emitted('changed')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it.each(['set-default', 'delete'])(
        'says the methods changed when one is %s in the list',
        async (event) => {
            const wrapper = mountModal();

            wrapper.findComponent({ name: 'PaymentMethodsListStub' }).vm.$emit(event);

            expect(wrapper.emitted('changed')).toHaveLength(1);
        },
    );
});
