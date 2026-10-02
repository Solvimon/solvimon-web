import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Customer, Invoice, PaymentMethod } from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import ChargeOnDemandModal from './ChargeOnDemandModal.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const { mockPreview, mockCharge } = vi.hoisted(() => ({
    mockPreview: vi.fn(),
    mockCharge: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({
        previewChargeOnDemandPricingItems: mockPreview,
        chargeOnDemandPricingItems: mockCharge,
    }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ChargeOnDemandForm: defineComponent({
            name: 'ChargeOnDemandFormStub',
            props: [
                'items',
                'selection',
                'paymentMethodId',
                'preview',
                'isPreviewLoading',
                'paymentMethods',
                'canAddPaymentMethod',
                'errors',
                'disabled',
            ],
            emits: ['update:selection', 'update:paymentMethodId', 'add-payment-method'],
            template: '<div data-testid="charge-on-demand-form" />',
        }),
        Modal: defineComponent({
            name: 'ModalStub',
            props: [
                'showModal',
                'title',
                'subTitle',
                'cancelButtonText',
                'confirmButtonText',
                'isLoading',
                'size',
                'noClickAway',
            ],
            emits: ['confirm', 'close'],
            template: `
                <div v-if="showModal">
                    <h1>{{ title }}</h1>
                    <p>{{ subTitle }}</p>
                    <slot name="body" />
                    <slot name="footer" />
                </div>
            `,
        }),
    });
});

const customer = { id: 'cust_1' } as unknown as Customer;

const items: ChargeOnDemandItem[] = [
    {
        pricingItemId: 'prii_consulting',
        pricingItemConfigId: 'pric_consulting',
        name: 'Consulting hours',
        priceType: 'FLAT',
        price: { quantity: '120', currency: 'EUR' },
        defaultUnits: 2,
    },
];

const card = (id: string, integrationId = 'int_stripe') =>
    ({
        id,
        type: 'CARD',
        status: 'ACTIVE',
        integration_id: integrationId,
        card: { brand: 'VISA', last_four_digits: '4242' },
    }) as unknown as PaymentMethod;

const subscription = {
    id: 'ppsu_1',
    name: 'Pro plan',
    variant: 'DEFAULT',
    payment_method_id: 'pmet_subscription',
    payment_acceptor_ids: ['pacc_stripe'],
    payment_acceptors: [{ id: 'pacc_stripe', payment_gateway: { integration_id: 'int_stripe' } }],
    pricing_plan_schedule_infos: [],
} as unknown as PricingPlanSubscriptionExpanded;

const preview = {
    id: 'inv_preview',
    invoice_amount_including_tax: { quantity: '290.40', currency: 'EUR' },
} as unknown as Invoice;

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(ChargeOnDemandModal, {
        props: {
            showModal: true,
            subscription,
            scheduleId: 'ppsc_1',
            items,
            customer,
            paymentMethods: [
                card('pmet_other'),
                card('pmet_subscription'),
                card('pmet_adyen', 'int_adyen'),
            ],
            ...props,
        },
        attachTo: document.body,
    });

const findForm = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'ChargeOnDemandFormStub' });

const findConfirm = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.find('[data-testid="charge-on-demand-confirm"]');

describe('ChargeOnDemandModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockPreview.mockResolvedValue(preview);
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it("offers the payment methods that can pay, preselecting the subscription's own", () => {
        const form = findForm(mountModal());

        expect((form.props('paymentMethods') as PaymentMethod[]).map(({ id }) => id)).toEqual([
            'pmet_subscription',
            'pmet_other',
        ]);
        expect(form.props('paymentMethodId')).toBe('pmet_subscription');
    });

    it('asks for an item before it can be paid', () => {
        const confirm = findConfirm(mountModal());

        expect(confirm.text()).toBe('Add an item to continue');
        expect(confirm.attributes()).toHaveProperty('disabled');
    });

    it('previews the added items and offers to pay the total', async () => {
        const wrapper = mountModal();

        findForm(wrapper).vm.$emit('update:selection', [
            { pricingItemId: 'prii_consulting', units: 2 },
        ]);
        await vi.runAllTimersAsync();
        await flushPromises();

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_consulting', units: { number: '2' } }],
        });
        expect(findForm(wrapper).props('preview')).toEqual(preview);
        expect(findConfirm(wrapper).text()).toContain('Pay');
        expect(findConfirm(wrapper).text()).toContain('290.40');
        expect(findConfirm(wrapper).attributes()).not.toHaveProperty('disabled');
    });

    it("says ordering isn't available when the subscription cannot take payments", () => {
        const wrapper = mountModal({
            subscription: { ...subscription, payment_acceptor_ids: [] },
        });

        expect(findForm(wrapper).exists()).toBe(false);
        expect(wrapper.find('.sv-charge-on-demand-modal__unavailable').exists()).toBe(true);
        expect(findConfirm(wrapper).exists()).toBe(false);
    });
});
