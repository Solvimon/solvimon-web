import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Customer, Invoice, PaymentMethod } from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import ChargeOnDemandModal from './ChargeOnDemandModal.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const { mockPreview, mockCharge, mockLoadPaymentMethodOptions, gateway } = vi.hoisted(() => ({
    mockPreview: vi.fn(),
    mockCharge: vi.fn(),
    mockLoadPaymentMethodOptions: vi.fn(),
    gateway: {} as { options: { value: unknown[] }; isPending: { value: boolean } },
}));

vi.mock('@/composables/usePaymentMethodOptions', async () => {
    const { ref } = await import('vue');

    gateway.options = ref<unknown[]>([]);
    gateway.isPending = ref(false);

    return {
        usePaymentMethodOptions: () => ({
            paymentMethodOptions: gateway.options,
            get: mockLoadPaymentMethodOptions,
            isPending: gateway.isPending,
        }),
    };
});

vi.mock('@/public/components/PaymentMethodForm/PaymentMethodForm.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodFormStub',
        props: [
            'customer',
            'paymentMethodOptions',
            'isLoading',
            'configuration',
            'hideSubmitButton',
        ],
        emits: ['success', 'failure'],
        setup(_props, { expose }) {
            expose({ submit: vi.fn(), isPaymentPending: false });
        },
        template: '<div data-testid="payment-method-form" />',
    }),
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
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: ['invoice', 'isCustomerFacing', 'isPaid'],
            template: '<div data-testid="invoice-preview" />',
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
    customer_id: 'cust_1',
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
        mockLoadPaymentMethodOptions.mockResolvedValue([]);
        gateway.options.value = [
            { payment_acceptor: { id: 'pacc_stripe' }, integration: { id: 'int_stripe' } },
            { payment_acceptor: { id: 'pacc_platform' }, integration: { id: 'int_platform' } },
        ];
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('puts its class on the modal content, where a style override can reach it', () => {
        const modal = mountModal().findComponent({ name: 'ModalStub' });

        // The real modal teleports, so a class left on its root would be dropped.
        expect(modal.attributes('class')).toBeUndefined();
        expect(modal.find('.sv-charge-on-demand-modal').exists()).toBe(true);
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

    describe('paying', () => {
        const addItemAndWaitForTotal = async (wrapper: ReturnType<typeof mountModal>) => {
            findForm(wrapper).vm.$emit('update:selection', [
                { pricingItemId: 'prii_consulting', units: 3 },
            ]);
            await vi.runAllTimersAsync();
            await flushPromises();
        };

        const chargedInvoice = {
            id: 'inv_charged',
            payment_status: 'PAID',
            invoice_amount_including_tax: { quantity: '435.60', currency: 'EUR' },
        } as unknown as Invoice;

        it('charges the items to the chosen payment method and finalizes the invoice', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);

            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(mockCharge).toHaveBeenCalledWith({
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_items: [{ pricing_item_id: 'prii_consulting', units: { number: '3' } }],
                payment_method_id: 'pmet_subscription',
                finalize_immediately: true,
            });
            expect(wrapper.text()).toContain('Payment successful');
        });

        it('reports the charged invoice when the customer is done', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            await wrapper.find('[data-testid="charge-on-demand-done"]').trigger('click');

            expect(wrapper.emitted('charged')).toEqual([[chargedInvoice]]);
            expect(wrapper.emitted('close')).toHaveLength(1);
        });

        it('holds the order while the charge is in flight', async () => {
            mockCharge.mockReturnValue(new Promise(() => {}));
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);

            await findConfirm(wrapper).trigger('click');
            await findConfirm(wrapper).trigger('click');

            expect(mockCharge).toHaveBeenCalledTimes(1);
            expect(findForm(wrapper).props('disabled')).toBe(true);
        });

        it('says the order could not be completed when the charge fails', async () => {
            mockCharge.mockRejectedValue(new Error('boom'));
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);

            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(findForm(wrapper).props('errors')).toEqual({
                form: expect.stringContaining("couldn't complete your order"),
            });
        });
    });

    describe('adding a payment method', () => {
        const openAddPaymentMethod = async (wrapper: ReturnType<typeof mountModal>) => {
            findForm(wrapper).vm.$emit('add-payment-method');
            await flushPromises();
        };

        it("loads the subscription's payment method options through its customer when it opens", () => {
            mountModal();

            expect(mockLoadPaymentMethodOptions).toHaveBeenCalledWith(
                expect.objectContaining({ customerId: 'cust_1', subscriptionId: 'ppsu_1' }),
            );
        });

        it("offers only the options of the subscription's own payment acceptors", async () => {
            const wrapper = mountModal();
            await openAddPaymentMethod(wrapper);

            const options = wrapper
                .findComponent({ name: 'PaymentMethodFormStub' })
                .props('paymentMethodOptions') as { payment_acceptor: { id: string } }[];

            expect(options.map(({ payment_acceptor }) => payment_acceptor.id)).toEqual([
                'pacc_stripe',
            ]);
            expect(
                wrapper.find('[data-testid="charge-on-demand-save-payment-method"]').exists(),
            ).toBe(true);
        });

        const isOnAddPaymentMethod = (wrapper: ReturnType<typeof mountModal>) =>
            wrapper.find('[data-testid="charge-on-demand-save-payment-method"]').exists();

        it('says the options could not be loaded rather than that none are set up', async () => {
            mockLoadPaymentMethodOptions.mockRejectedValue(undefined);
            const wrapper = mountModal();
            await flushPromises();

            await openAddPaymentMethod(wrapper);

            expect(isOnAddPaymentMethod(wrapper)).toBe(false);
            expect(findForm(wrapper).props('errors')).toEqual({
                form: expect.stringContaining("couldn't load the ways to add a payment method"),
            });
        });

        it('retries a failed lookup when the customer goes to add a payment method again', async () => {
            mockLoadPaymentMethodOptions.mockRejectedValueOnce(undefined);
            const wrapper = mountModal();
            await flushPromises();
            expect(mockLoadPaymentMethodOptions).toHaveBeenCalledTimes(1);

            await openAddPaymentMethod(wrapper);

            expect(mockLoadPaymentMethodOptions).toHaveBeenCalledTimes(2);
            expect(isOnAddPaymentMethod(wrapper)).toBe(true);
            expect(findForm(wrapper).props('errors')).toBeUndefined();
        });

        it('does not look the options up again once they loaded', async () => {
            const wrapper = mountModal();
            await flushPromises();

            await openAddPaymentMethod(wrapper);

            expect(mockLoadPaymentMethodOptions).toHaveBeenCalledTimes(1);
        });

        it('selects the stored payment method once it is reloaded', async () => {
            const wrapper = mountModal();
            await openAddPaymentMethod(wrapper);

            wrapper.findComponent({ name: 'PaymentMethodFormStub' }).vm.$emit('success');
            await flushPromises();

            expect(wrapper.emitted('payment-method-stored')).toHaveLength(1);

            await wrapper.setProps({
                paymentMethods: [card('pmet_other'), card('pmet_subscription'), card('pmet_new')],
            });

            expect(findForm(wrapper).props('paymentMethodId')).toBe('pmet_new');
        });
    });
});
