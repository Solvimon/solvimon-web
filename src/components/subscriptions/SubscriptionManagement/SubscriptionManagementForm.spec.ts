import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type {
    BillingPeriod,
    PaymentMethod,
    PaymentMethodOptionsResponse,
    PricingGroupExtended,
} from '@solvimon/solvimon-types';
import SubscriptionManagementForm from './SubscriptionManagementForm.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // Resolves its own IntlProvider internally, which is not mounted here.
        usePricingItem: () => ({
            renderPricingForPricingItem: () => '€ 50,00 per month',
        }),
        // Renders a default-chip that resolves its own IntlProvider too.
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: { paymentMethod: { type: Object, required: true } },
            setup(props) {
                return () =>
                    h('div', { class: 'sv-payment-method-stub' }, String(props.paymentMethod.id));
            },
        }),
    });
});

const billingPeriod: BillingPeriod = { type: 'MONTH', value: 1 };

const pricingGroup = {
    id: 'prig_1',
    name: 'Plan',
    product_type: 'DEFAULT',
    selection_constraint: 'EXACTLY_ONE',
    pricings: [
        { id: 'pric_basic', name: 'Basic Plan', items: [] },
        { id: 'pric_premium', name: 'Premium Plan', items: [] },
    ],
} as unknown as PricingGroupExtended;

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        type: 'CARD',
        card: { brand: 'visa', last_four_digits: '4242' },
        is_default: false,
        created_at: '2026-01-01T00:00:00Z',
        ...overrides,
    }) as unknown as PaymentMethod;

const mountComponent = ({
    enabledPricingIds = ['pric_basic'],
    paymentMethods = [createPaymentMethod()],
    paymentMethodId,
    paymentMethodOptions,
}: {
    enabledPricingIds?: string[];
    paymentMethods?: PaymentMethod[];
    paymentMethodId?: string;
    paymentMethodOptions?: PaymentMethodOptionsResponse;
} = {}) =>
    mount(SubscriptionManagementForm, {
        props: {
            pricingGroup,
            paymentMethods,
            paymentMethodOptions,
            billingPeriod,
            enabledPricingIds,
            paymentMethodId,
            'onUpdate:enabledPricingIds': (value: string[]) => value,
            'onUpdate:paymentMethodId': (value?: string) => value,
        },
        global: { stubs: { teleport: true } },
    });

describe('SubscriptionManagementForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the pricing group selector for the group being changed', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-management-form__pricing-group').exists()).toBe(true);
        expect(wrapper.text()).toContain('Plan');
        expect(wrapper.text()).toContain('Basic Plan');
        expect(wrapper.text()).toContain('Premium Plan');
    });

    it('renders the payment method selector below it', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-management-form__payment-methods').exists()).toBe(
            true,
        );
        expect(wrapper.text()).toContain('Payment method');
    });

    describe('payment method default', () => {
        it('starts on the customer default', () => {
            const wrapper = mountComponent({
                paymentMethods: [
                    createPaymentMethod({ id: 'pm_old', created_at: '2025-01-01T00:00:00Z' }),
                    createPaymentMethod({ id: 'pm_default', is_default: true }),
                ],
            });

            expect(wrapper.emitted('update:paymentMethodId')?.at(-1)).toEqual(['pm_default']);
        });

        it('falls back to the newest method when none is the default', () => {
            const wrapper = mountComponent({
                paymentMethods: [
                    createPaymentMethod({ id: 'pm_old', created_at: '2025-01-01T00:00:00Z' }),
                    createPaymentMethod({ id: 'pm_new', created_at: '2026-06-01T00:00:00Z' }),
                ],
            });

            expect(wrapper.emitted('update:paymentMethodId')?.at(-1)).toEqual(['pm_new']);
        });

        it('leaves a choice the customer already made alone', () => {
            const wrapper = mountComponent({
                paymentMethodId: 'pm_chosen',
                paymentMethods: [
                    createPaymentMethod({ id: 'pm_chosen' }),
                    createPaymentMethod({ id: 'pm_default', is_default: true }),
                ],
            });

            expect(wrapper.emitted('update:paymentMethodId')).toBeUndefined();
        });

        it('selects nothing when the customer has no payment methods', () => {
            const wrapper = mountComponent({ paymentMethods: [] });

            expect(wrapper.emitted('update:paymentMethodId')).toBeUndefined();
        });
    });

    it('reports the customer wanting to add a payment method', async () => {
        const wrapper = mountComponent();

        wrapper.findComponent({ name: 'PaymentMethodSelector' }).vm.$emit('add-payment-method');
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('add-payment-method')).toHaveLength(1);
    });

    it('tells the selector what the customer is allowed to add', () => {
        const wrapper = mountComponent({
            paymentMethodOptions: [] as unknown as PaymentMethodOptionsResponse,
        });

        expect(
            wrapper.findComponent({ name: 'PaymentMethodSelector' }).props('paymentMethodOptions'),
        ).toEqual([]);
    });

    it('moves to a payment method the customer has just added', async () => {
        const wrapper = mountComponent({
            paymentMethods: [createPaymentMethod({ id: 'pm_existing', is_default: true })],
        });

        await wrapper.setProps({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_existing', is_default: true }),
                createPaymentMethod({ id: 'pm_added', created_at: '2020-01-01T00:00:00Z' }),
            ],
        });

        expect(wrapper.emitted('update:paymentMethodId')?.at(-1)).toEqual(['pm_added']);
    });
});
