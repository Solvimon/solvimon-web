import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { Customer, Invoice, PaymentMethod } from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import ChargeOnDemandModal from './ChargeOnDemandModal.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { ApiError } from '@/services/apiError';

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
        ChargeOnDemandEditor: defineComponent({
            name: 'ChargeOnDemandEditorStub',
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
    wrapper.findComponent({ name: 'ChargeOnDemandEditorStub' });

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

    it.each([0, 2.5, undefined])(
        'holds an order with %s units until the quantity can be ordered',
        async (units) => {
            const wrapper = mountModal();

            findForm(wrapper).vm.$emit('update:selection', [
                { pricingItemId: 'prii_consulting', units },
            ]);
            await vi.runAllTimersAsync();
            await flushPromises();

            expect(mockPreview).not.toHaveBeenCalled();
            expect(findForm(wrapper).props('errors')).toEqual({
                items: { prii_consulting: 'Enter a whole number of 1 or more.' },
            });
            expect(findConfirm(wrapper).text()).toBe('Check the quantities to continue');
            expect(findConfirm(wrapper).attributes()).toHaveProperty('disabled');

            findForm(wrapper).vm.$emit('update:selection', [
                { pricingItemId: 'prii_consulting', units: 3 },
            ]);
            await vi.runAllTimersAsync();
            await flushPromises();

            expect(findForm(wrapper).props('errors')).toBeUndefined();
            expect(mockPreview).toHaveBeenCalledWith({
                pricingPlanScheduleId: 'ppsc_1',
                pricingItems: [{ pricing_item_id: 'prii_consulting', units: { number: '3' } }],
            });
        },
    );

    it('says the total failed to load and asks for it again from the pay button', async () => {
        mockPreview.mockRejectedValueOnce(new Error('nope'));
        const wrapper = mountModal();

        findForm(wrapper).vm.$emit('update:selection', [
            { pricingItemId: 'prii_consulting', units: 2 },
        ]);
        await vi.runAllTimersAsync();
        await flushPromises();

        expect(findForm(wrapper).props('errors')).toEqual({
            form: "We couldn't calculate the total. Please try again.",
        });
        expect(findConfirm(wrapper).text()).toBe('Calculate total again');
        expect(findConfirm(wrapper).attributes()).not.toHaveProperty('disabled');

        await findConfirm(wrapper).trigger('click');
        await flushPromises();

        expect(mockPreview).toHaveBeenCalledTimes(2);
        expect(mockCharge).not.toHaveBeenCalled();
        expect(findForm(wrapper).props('errors')).toBeUndefined();
        expect(findConfirm(wrapper).text()).toContain('290.40');
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
            expect(wrapper.text()).toContain('Order placed');
        });

        it('reports the created invoice as soon as the order is placed', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(wrapper.emitted('invoice-created')).toEqual([[chargedInvoice]]);
            expect(wrapper.emitted('close')).toBeUndefined();
        });

        it('closes the receipt when the customer is done', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(wrapper.emitted('close')).toBeUndefined();

            await wrapper.find('[data-testid="charge-on-demand-done"]').trigger('click');

            expect(wrapper.emitted('invoice-created')).toHaveLength(1);
            expect(wrapper.emitted('close')).toHaveLength(1);
        });

        it('offers no way to the invoice unless the host can open it', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(wrapper.find('[data-testid="charge-on-demand-view-invoice"]').exists()).toBe(
                false,
            );
            expect(wrapper.find('[data-testid="charge-on-demand-done"]').classes()).toContain(
                'sv-action--primary',
            );
        });

        it('takes the customer to the invoice of the paid order on the way out', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal({ canViewCreatedInvoice: true });
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            await wrapper.find('[data-testid="charge-on-demand-view-invoice"]').trigger('click');

            expect(wrapper.emitted('close')).toHaveLength(1);
            expect(wrapper.emitted('view-invoice')).toEqual([[chargedInvoice.id]]);
        });

        describe('when the order is placed but its invoice is not paid', () => {
            const unpaidInvoice = { ...chargedInvoice, payment_status: 'UNPAID' } as Invoice;

            const placeUnpaidOrder = async (props: Record<string, unknown> = {}) => {
                mockCharge.mockResolvedValue(unpaidInvoice);
                const wrapper = mountModal(props);
                await addItemAndWaitForTotal(wrapper);
                await findConfirm(wrapper).trigger('click');
                await flushPromises();
                return wrapper;
            };

            it('says the invoice was created but is not paid yet', async () => {
                const wrapper = await placeUnpaidOrder();

                expect(wrapper.text()).toContain('Order placed');
                expect(wrapper.text()).toContain(
                    "Your invoice was created, but it isn't paid yet.",
                );
                expect(wrapper.text()).not.toContain('Your order is paid');
            });

            it('offers no way to pay again, which would place a second order', async () => {
                const wrapper = await placeUnpaidOrder();

                expect(findConfirm(wrapper).exists()).toBe(false);
            });

            it('leads with the invoice, where the order can be followed up', async () => {
                const wrapper = await placeUnpaidOrder({ canViewCreatedInvoice: true });

                const buttons = wrapper.findAll('button[data-testid^="charge-on-demand-"]');
                expect(buttons[0]?.attributes('data-testid')).toBe('charge-on-demand-view-invoice');

                await wrapper
                    .find('[data-testid="charge-on-demand-view-invoice"]')
                    .trigger('click');

                expect(wrapper.emitted('close')).toHaveLength(1);
                expect(wrapper.emitted('view-invoice')).toEqual([[unpaidInvoice.id]]);
            });

            it('leads with closing when the host cannot open the invoice', async () => {
                const wrapper = await placeUnpaidOrder();

                expect(wrapper.find('[data-testid="charge-on-demand-view-invoice"]').exists()).toBe(
                    false,
                );
                expect(wrapper.find('[data-testid="charge-on-demand-done"]').classes()).toContain(
                    'sv-action--primary',
                );
            });

            it('reports the invoice, but not as paid', async () => {
                const wrapper = await placeUnpaidOrder();

                expect(wrapper.emitted('invoice-created')).toEqual([[unpaidInvoice]]);

                await wrapper.find('[data-testid="charge-on-demand-done"]').trigger('click');

                expect(wrapper.emitted('close')).toHaveLength(1);
            });
        });

        it('says the order is paid', async () => {
            mockCharge.mockResolvedValue(chargedInvoice);
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(wrapper.text()).toContain(
                'Your order is paid. The invoice is in your invoice list.',
            );
        });

        it('treats an overpaid order as paid', async () => {
            mockCharge.mockResolvedValue({ ...chargedInvoice, payment_status: 'OVERPAID' });
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);
            await findConfirm(wrapper).trigger('click');
            await flushPromises();

            expect(wrapper.text()).toContain('Your order is paid');
        });

        it('does not charge a changed order on the total of the one before', async () => {
            const wrapper = mountModal();
            await addItemAndWaitForTotal(wrapper);

            findForm(wrapper).vm.$emit('update:selection', [
                { pricingItemId: 'prii_consulting', units: 4 },
            ]);
            await nextTick();

            expect(findConfirm(wrapper).text()).toContain('Updating total');
            expect(findConfirm(wrapper).attributes()).toHaveProperty('disabled');

            await findConfirm(wrapper).trigger('click');

            expect(mockCharge).not.toHaveBeenCalled();
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

        describe('when the charge fails', () => {
            const failCharge = async (error: unknown) => {
                mockCharge.mockRejectedValue(error);
                const wrapper = mountModal();
                await addItemAndWaitForTotal(wrapper);
                await findConfirm(wrapper).trigger('click');
                await flushPromises();
                return wrapper;
            };

            it('asks for another method when the chosen one cannot pay, and lets the customer retry', async () => {
                const wrapper = await failCharge(
                    new ApiError({ statusCode: 400, field: 'payment_method_id' }),
                );

                expect(findForm(wrapper).props('errors')).toEqual({
                    form: expect.stringContaining('Choose another one'),
                });
                expect(findConfirm(wrapper).exists()).toBe(true);

                findForm(wrapper).vm.$emit('update:paymentMethodId', 'pmet_other');
                await flushPromises();

                expect(findForm(wrapper).props('errors')).toBeUndefined();
            });

            it('asks the customer to check an order whose items were not accepted, until they change it', async () => {
                const wrapper = await failCharge(
                    new ApiError({ statusCode: 400, field: 'pricing_items.0.units.number' }),
                );

                expect(findForm(wrapper).props('errors')).toEqual({
                    form: expect.stringContaining('Check your order and try again'),
                });
                expect(findConfirm(wrapper).attributes()).not.toHaveProperty('disabled');

                findForm(wrapper).vm.$emit('update:selection', [
                    { pricingItemId: 'prii_consulting', units: 2 },
                ]);
                await flushPromises();

                expect(findForm(wrapper).props('errors')).toBeUndefined();
            });

            it('says the subscription cannot take orders and disables paying', async () => {
                const wrapper = await failCharge(
                    new ApiError({ statusCode: 400, field: 'pricing_plan_subscription_id' }),
                );

                expect(findForm(wrapper).props('errors')).toEqual({
                    form: expect.stringContaining("can't take orders right now"),
                });
                expect(findConfirm(wrapper).attributes()).toHaveProperty('disabled');
            });

            it.each([
                [
                    'the payment could not be made',
                    new ApiError({ statusCode: 422 }),
                    'Payment not completed',
                    "We couldn't take the payment for this order",
                ],
                [
                    'the request was refused for a reason the customer cannot fix',
                    new ApiError({ statusCode: 400, field: 'pricing_plan_schedule_id' }),
                    'Something went wrong',
                    'Check your invoice list before trying again',
                ],
                [
                    'the customer or the new invoice was locked',
                    new ApiError({ statusCode: 406 }),
                    'Something went wrong',
                    'Check your invoice list before trying again',
                ],
                [
                    'the server failed',
                    new ApiError({ statusCode: 500 }),
                    'Something went wrong',
                    'Check your invoice list before trying again',
                ],
                [
                    'the placed invoice could not be found',
                    new ApiError({ statusCode: 404 }),
                    'Something went wrong',
                    'Check your invoice list before trying again',
                ],
                [
                    'no response came back',
                    new TypeError('Failed to fetch'),
                    'Something went wrong',
                    'Check your invoice list before trying again',
                ],
            ])('ends the order without a retry when %s', async (_case, error, title, message) => {
                const wrapper = await failCharge(error);

                expect(wrapper.text()).toContain(title);
                expect(wrapper.text()).toContain(message);
                expect(findConfirm(wrapper).exists()).toBe(false);

                await wrapper.find('[data-testid="charge-on-demand-close"]').trigger('click');

                expect(wrapper.emitted('close')).toHaveLength(1);
                expect(wrapper.emitted('invoice-created')).toBeUndefined();
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

        it('keeps the chosen method when the customer goes back without storing one', async () => {
            const wrapper = mountModal();
            findForm(wrapper).vm.$emit('update:paymentMethodId', 'pmet_other');
            await openAddPaymentMethod(wrapper);

            await wrapper.find('[data-testid="charge-on-demand-cancel"]').trigger('click');
            await wrapper.setProps({
                paymentMethods: [card('pmet_other'), card('pmet_subscription'), card('pmet_new')],
            });

            expect(findForm(wrapper).props('paymentMethodId')).toBe('pmet_other');
        });

        it('keeps the chosen method on later reloads when the stored one cannot pay', async () => {
            const wrapper = mountModal();
            findForm(wrapper).vm.$emit('update:paymentMethodId', 'pmet_other');
            await openAddPaymentMethod(wrapper);

            wrapper.findComponent({ name: 'PaymentMethodFormStub' }).vm.$emit('success');
            await flushPromises();
            await wrapper.setProps({
                paymentMethods: [
                    card('pmet_other'),
                    card('pmet_subscription'),
                    card('pmet_elsewhere', 'int_elsewhere'),
                ],
            });
            await wrapper.setProps({
                paymentMethods: [
                    card('pmet_other'),
                    card('pmet_subscription'),
                    card('pmet_elsewhere', 'int_elsewhere'),
                    card('pmet_later'),
                ],
            });

            expect(findForm(wrapper).props('paymentMethodId')).toBe('pmet_other');
        });
    });
});
