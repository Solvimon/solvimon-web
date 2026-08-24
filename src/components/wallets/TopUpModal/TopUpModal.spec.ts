import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type {
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import TopUpModal from './TopUpModal.vue';

const {
    mockCharge,
    mockCreateAutoTopUp,
    mockSubmitPaymentMethod,
    mockLoadPaymentMethodOptions,
    mockPreview,
    gateway,
} = vi.hoisted(() => ({
    mockCharge: vi.fn(),
    mockCreateAutoTopUp: vi.fn(),
    mockSubmitPaymentMethod: vi.fn(),
    mockLoadPaymentMethodOptions: vi.fn(),
    mockPreview: vi.fn().mockResolvedValue({ id: 'inv_1' }),
    gateway: {} as {
        options: { value: unknown[] };
        isPending: { value: boolean };
    },
}));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ createAutoTopUpConfig: mockCreateAutoTopUp }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({
        previewChargeOnDemandPricingItems: mockPreview,
        chargeOnDemandPricingItems: mockCharge,
    }),
}));

vi.mock('@/composables/usePaymentMethodOptions', async () => {
    const { ref } = await import('vue');

    gateway.options = ref<unknown[]>([{ id: 'pmo_card' }]);
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
            expose({ submit: mockSubmitPaymentMethod, isPaymentPending: false });
        },
        template: '<div data-testid="payment-method-form" />',
    }),
}));

vi.mock('@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodSelectorStub',
        props: ['modelValue', 'paymentMethods', 'label', 'required', 'disabled'],
        emits: ['update:modelValue', 'add-payment-method'],
        template: '<div data-testid="payment-method-selector" />',
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        FlexiblePricingInput: defineComponent({
            name: 'FlexiblePricingInputStub',
            props: ['modelValue', 'config', 'currency', 'creditsConfiguration', 'label', 'error'],
            emits: ['update:modelValue'],
            template: '<div data-testid="flexible-pricing-input" />',
        }),
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: ['invoice', 'isCustomerFacing'],
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
                    <slot name="footer">
                        <button type="button" data-testid="cancel" @click="$emit('close')">
                            {{ cancelButtonText }}
                        </button>
                        <button type="button" data-testid="confirm" @click="$emit('confirm')">
                            {{ confirmButtonText }}
                        </button>
                    </slot>
                </div>
            `,
        }),
    });
});

const customer = {
    id: 'cust_1',
    billing_address: { country_code: 'NL' },
} as unknown as Customer;

const credits = (quantity: string) => ({
    quantity,
    credit_type_id: 'ctyp_1',
    credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
});

const balanceItem = {
    wallet_type_id: 'wtyp_1',
    wallet_balance: {
        open_balance: { credits: credits('500') },
        balance: { credits: credits('500') },
    },
    charge_on_demand_pricing_items: [
        {
            pricing_item_id: 'prii_fixed',
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_item: {
                id: 'prii_fixed',
                configs: [
                    {
                        id: 'pico_fixed',
                        on_demand: true,
                        details: {
                            pricing_type: 'FIXED',
                            bands: [{ fixed_amount: { quantity: '10.00', currency: 'EUR' } }],
                        },
                        wallet_grants: [
                            {
                                wallet_type_id: 'wtyp_1',
                                credits_grant: { credits: credits('1000') },
                            },
                        ],
                    },
                ],
            },
        },
    ],
} as unknown as CustomerWalletBalanceItem;

const storedPaymentMethod = {
    id: 'pmet_1',
    type: 'CARD',
    status: 'ACTIVE',
    card: { brand: 'VISA', last_four_digits: '4242' },
} as unknown as PaymentMethod;

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(TopUpModal, {
        props: {
            showModal: true,
            customer,
            selectedBalanceItem: balanceItem,
            paymentMethods: [storedPaymentMethod],
            ...props,
        },
        attachTo: document.body,
    });

const trackOffset = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.find<HTMLElement>('.sv-sliding-panes__track').element.style.transform;

const atStep = (index: number) =>
    index === 0 ? 'translateX(0px)' : `translateX(calc(${-index} * (100% + 1rem)))`;

const startAddingPaymentMethod = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.findComponent({ name: 'TopUpModalForm' }).vm.$emit('add-payment-method');
    // The form is fetched on demand, so it lands a tick after the step over rather than with it.
    await flushPromises();
};

const selector = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'PaymentMethodSelectorStub' });

const startCharge = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.find<HTMLInputElement>('input[type="radio"]').setValue();
    await wrapper.find('[data-testid="confirm"]').trigger('click');
    await nextTick();

    return wrapper;
};

const chargeTopUp = async (wrapper: ReturnType<typeof mountModal>) => {
    await startCharge(wrapper);
    await vi.runAllTimersAsync();

    return wrapper;
};

describe('TopUpModal — closed', () => {
    beforeEach(() => {
        mockLoadPaymentMethodOptions.mockClear();
        mockPreview.mockClear();
    });

    it('asks the gateway for nothing until it is opened', async () => {
        const wrapper = mountModal({ showModal: false, selectedBalanceItem: undefined });
        await nextTick();

        expect(mockLoadPaymentMethodOptions).not.toHaveBeenCalled();
        expect(mockPreview).not.toHaveBeenCalled();

        await wrapper.setProps({ showModal: true, selectedBalanceItem: balanceItem });
        await nextTick();

        expect(mockLoadPaymentMethodOptions).toHaveBeenCalledTimes(1);
    });

    it('previews nothing until it is opened', async () => {
        mountModal({ showModal: false, selectedBalanceItem: balanceItem });
        await nextTick();

        expect(mockPreview).not.toHaveBeenCalled();
    });
});

describe('TopUpModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockCharge.mockResolvedValue({ id: 'inv_charged' });
        gateway.options.value = [{ id: 'pmo_card' }];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('slides the track over to the add-a-method pane', async () => {
        const wrapper = mountModal();
        expect(trackOffset(wrapper)).toBe(atStep(0));

        await startAddingPaymentMethod(wrapper);

        expect(trackOffset(wrapper)).toBe(atStep(1));
    });

    it("names the chosen top-up on the confirm button, in the wallet's own terms", async () => {
        const wrapper = mountModal();

        await wrapper.find<HTMLInputElement>('input[type="radio"]').setValue();
        await nextTick();

        expect(wrapper.find('[data-testid="confirm"]').text()).toBe(
            'Top up balance with 1000 coins',
        );
    });

    it('builds the payment method form only once it is asked for', async () => {
        const wrapper = mountModal();
        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(false);

        await startAddingPaymentMethod(wrapper);

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(true);
    });

    it('renames its chrome for the add-a-method step', async () => {
        const wrapper = mountModal();
        expect(wrapper.text()).toContain('Top up balance');
        expect(wrapper.text()).toContain('Your current balance is');

        await startAddingPaymentMethod(wrapper);

        expect(wrapper.text()).toContain('Add payment method');
        expect(wrapper.text()).toContain('Back');
    });

    it('steps back to the top-up rather than closing when cancelled while adding', async () => {
        const wrapper = mountModal();
        await startAddingPaymentMethod(wrapper);

        await wrapper.find('[data-testid="cancel"]').trigger('click');
        await nextTick();

        expect(wrapper.emitted('close')).toBeUndefined();
        expect(trackOffset(wrapper)).toBe(atStep(0));
    });

    it('closes when cancelled on the top-up itself', async () => {
        const wrapper = mountModal();

        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('hands the customer back to topping up after storing a payment method', async () => {
        const wrapper = mountModal();
        await startAddingPaymentMethod(wrapper);

        await wrapper.findComponent({ name: 'PaymentMethodFormStub' }).vm.$emit('success');
        await nextTick();

        expect(wrapper.emitted('payment-success')).toHaveLength(1);
        expect(trackOffset(wrapper)).toBe(atStep(0));
    });

    it('shows the confirm button working while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('isLoading')).toBe(true);
    });

    it('disables every input while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        expect(wrapper.find<HTMLInputElement>('input[type="radio"]').element.disabled).toBe(true);
        expect(selector(wrapper).props('disabled')).toBe(true);
    });

    it('refuses to be cancelled while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        await wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');

        // The money may already be on its way; the modal's own cancel button cannot be disabled, so
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('lets go again once the charge comes back', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('isLoading')).toBe(false);
    });

    it('slides on to the confirmation once the top-up is charged', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(trackOffset(wrapper)).toBe(atStep(2));
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });

    it('holds the charge back while the customer is still on the receipt', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.emitted('confirm')).toBeUndefined();
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('shows the receipt the charge produced', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.text()).toContain('Receipt');
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });

    it('renames its chrome for the confirmation', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.text()).toContain('Top-up complete');
        expect(wrapper.text()).toContain('Your payment went through.');
    });

    it('offers only a way out once the money has been taken', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.find('[data-testid="done"]').text()).toBe('Done');
        expect(wrapper.find('[data-testid="cancel"]').exists()).toBe(false);
    });

    it('reports the charge and closes when the receipt is done with', async () => {
        const wrapper = await chargeTopUp(mountModal());

        await wrapper.find('[data-testid="done"]').trigger('click');

        expect(wrapper.emitted('confirm')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('reports the charge when the receipt is closed by the cross too', async () => {
        const wrapper = await chargeTopUp(mountModal());

        // The cross reaches the modal as the same event the cancel button would, and the confirmation
        await wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');

        expect(wrapper.emitted('confirm')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('starts over when the modal is opened again', async () => {
        const wrapper = await chargeTopUp(mountModal());
        await wrapper.setProps({ showModal: false });

        await wrapper.setProps({ showModal: true });
        await nextTick();

        expect(trackOffset(wrapper)).toBe(atStep(0));
        expect(wrapper.find('input[type="radio"]').element).toHaveProperty('checked', true);
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });
});

describe('TopUpModal — nothing stored and nothing on offer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockSubmitPaymentMethod.mockReset();
        mockCharge.mockResolvedValue({ id: 'inv_charged' });
        gateway.options.value = [];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mountEmpty = () => mountModal({ paymentMethods: [] });

    const offeredOptions = (wrapper: ReturnType<typeof mountModal>) =>
        wrapper.findComponent({ name: 'TopUpModalForm' }).props('paymentMethodOptions');

    // the gateway offers, which is the thing the selector cannot find out for itself.
    it('tells the form what the gateway offers', () => {
        expect(offeredOptions(mountEmpty())).toEqual([]);
    });

    it('passes on what the gateway offers once it answers', async () => {
        const wrapper = mountEmpty();

        gateway.options.value = [{ id: 'pmo_card' }];
        await nextTick();

        expect(offeredOptions(wrapper)).toEqual([{ id: 'pmo_card' }]);
    });

    it('refuses to charge', () => {
        const wrapper = mountEmpty();

        expect(wrapper.find('[data-testid="confirm"]').attributes('disabled')).toBeDefined();
    });
});

describe('TopUpModal — while the gateway is still answering', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockSubmitPaymentMethod.mockReset();
        mockCharge.mockResolvedValue({ id: 'inv_charged' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('waits for the options before reporting that there are none', async () => {
        gateway.options.value = [];
        gateway.isPending.value = true;

        const wrapper = mountModal({ paymentMethods: [] });
        const offered = () =>
            wrapper.findComponent({ name: 'TopUpModalForm' }).props('paymentMethodOptions');

        expect(offered()).toBeUndefined();

        gateway.isPending.value = false;
        await nextTick();

        expect(offered()).toEqual([]);
    });
});

describe('TopUpModal — confirm when there is no way to pay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockSubmitPaymentMethod.mockReset();
        gateway.options.value = [];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('disables the confirm button', () => {
        const wrapper = mountModal({ paymentMethods: [] });

        expect(wrapper.find('[data-testid="confirm"]').attributes('disabled')).toBeDefined();
    });

    it('still lets the customer out', async () => {
        const wrapper = mountModal({ paymentMethods: [] });

        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('leaves the confirm button usable when a method can be added', () => {
        gateway.options.value = [{ id: 'pmo_card' }];

        const wrapper = mountModal({ paymentMethods: [] });

        expect(wrapper.find('[data-testid="confirm"]').attributes('disabled')).toBeUndefined();
    });
});

describe('TopUpModal — confirming on the add payment method pane', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockSubmitPaymentMethod.mockReset();
        gateway.options.value = [{ id: 'pmo_card' }];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('submits the payment method form rather than charging the top-up', async () => {
        const wrapper = mountModal();
        await startAddingPaymentMethod(wrapper);

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await nextTick();

        expect(mockSubmitPaymentMethod).toHaveBeenCalledTimes(1);
        expect(mockCharge).not.toHaveBeenCalled();
    });
});

describe('TopUpModal — a wallet topped up through several subscriptions', () => {
    const subscriptionOn = (id: string, name: string, scheduleId: string, pricingId: string) => ({
        id,
        name,
        pricing_plan_schedule_infos: [
            {
                id: scheduleId,
                pricing_plan_schedule: { enabled_pricings: [{ pricing_id: pricingId }] },
                pricing_plan_version: {
                    pricing_categories: [
                        {
                            pricings: [
                                { object_type: 'PRICING', id: pricingId, name: `${name} pricing` },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const twoSubscriptions = [
        subscriptionOn('ppsu_1', 'Pro plan', 'ppsc_1', 'pric_1'),
        subscriptionOn('ppsu_2', 'Credits add-on', 'ppsc_2', 'pric_2'),
    ] as unknown as PricingPlanSubscriptionExpanded[];

    beforeEach(() => {
        vi.useFakeTimers();
        mockCharge.mockReset();
        mockSubmitPaymentMethod.mockReset();
        mockCharge.mockResolvedValue({ id: 'inv_charged' });
        gateway.options.value = [{ id: 'pmo_card' }];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const subscriptionRadios = (wrapper: ReturnType<typeof mountModal>) =>
        wrapper.findAll<HTMLInputElement>('input[id^="radio_top-up-subscription"]');

    const sharedBalanceItem = {
        ...balanceItem,
        charge_on_demand_pricing_items: [
            {
                pricing_item_id: 'prii_first',
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_item: {
                    id: 'prii_first',
                    configs: [
                        {
                            id: 'pico_first',
                            on_demand: true,
                            details: {
                                pricing_type: 'FIXED',
                                bands: [{ fixed_amount: { quantity: '10.00', currency: 'EUR' } }],
                            },
                        },
                    ],
                },
            },
            {
                pricing_item_id: 'prii_second',
                pricing_plan_schedule_id: 'ppsc_2',
                pricing_item: {
                    id: 'prii_second',
                    configs: [
                        {
                            id: 'pico_second',
                            on_demand: true,
                            details: {
                                pricing_type: 'FIXED',
                                bands: [{ fixed_amount: { quantity: '20.00', currency: 'EUR' } }],
                            },
                        },
                    ],
                },
            },
        ],
    } as unknown as CustomerWalletBalanceItem;

    const mountWithChoice = (props: Record<string, unknown> = {}) =>
        mountModal({
            selectedBalanceItem: sharedBalanceItem,
            subscriptions: twoSubscriptions,
            ...props,
        });

    const offeredItemIds = (wrapper: ReturnType<typeof mountModal>) =>
        (
            wrapper.findComponent({ name: 'TopUpModalForm' }).props('topUpPricingItems') as {
                pricingItemId: string;
            }[]
        ).map(({ pricingItemId }) => pricingItemId);

    it('offers only the top-ups of the chosen subscription', () => {
        const wrapper = mountWithChoice();

        expect(offeredItemIds(wrapper)).toEqual(['prii_first']);
    });

    it('offers only the one subscription it is handed', () => {
        const wrapper = mountWithChoice({ subscriptions: [twoSubscriptions[1]] });

        expect(offeredItemIds(wrapper)).toEqual(['prii_second']);
    });

    it('offers nothing when none of the subscriptions it is handed bills the wallet', () => {
        const wrapper = mountWithChoice({
            subscriptions: [subscriptionOn('ppsu_3', 'Other', 'ppsc_other', 'pric_3')],
        });

        expect(offeredItemIds(wrapper)).toEqual([]);
    });

    it('offers the whole wallet when it is handed no subscriptions', () => {
        const wrapper = mountWithChoice({ subscriptions: [] });

        expect(offeredItemIds(wrapper)).toEqual(['prii_first', 'prii_second']);
    });

    it('swaps the top-ups over when another subscription is chosen', async () => {
        const wrapper = mountWithChoice();

        await subscriptionRadios(wrapper)[1].setValue();
        await nextTick();

        expect(offeredItemIds(wrapper)).toEqual(['prii_second']);
    });

    it('asks which subscription the top-up is for', () => {
        const wrapper = mountWithChoice();

        expect(subscriptionRadios(wrapper).map((radio) => radio.element.value)).toEqual([
            'ppsu_1',
            'ppsu_2',
        ]);
        expect(wrapper.text()).toContain('Pro plan');
        expect(wrapper.text()).toContain('Credits add-on');
    });

    it('draws each option as a subscription summary', () => {
        const wrapper = mountWithChoice();

        const summaries = wrapper.findAllComponents({ name: 'SubscriptionSummary' });

        expect(summaries).toHaveLength(2);
        expect(summaries.map((summary) => summary.props('subscription').id)).toEqual([
            'ppsu_1',
            'ppsu_2',
        ]);
    });

    it('names the pricings each subscription runs, as the checkout summary does', () => {
        const wrapper = mountWithChoice();

        expect(wrapper.text()).toContain('Pro plan pricing');
        expect(wrapper.text()).toContain('Credits add-on pricing');
    });

    it('starts on the first one', () => {
        const wrapper = mountWithChoice();

        expect(subscriptionRadios(wrapper).map((radio) => radio.element.checked)).toEqual([
            true,
            false,
        ]);
    });

    it('does not ask when the wallet has only one subscription behind it', () => {
        const wrapper = mountWithChoice({ subscriptions: [twoSubscriptions[0]] });

        expect(subscriptionRadios(wrapper)).toHaveLength(0);
    });

    it('does not ask when no subscriptions were given at all', () => {
        const wrapper = mountModal();

        expect(subscriptionRadios(wrapper)).toHaveLength(0);
    });
});

describe('TopUpModal — a rule set alongside the top-up', () => {
    const RULE = {
        status: 'ACTIVE' as const,
        threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
        topup_amount: { quantity: '10.00', currency: 'EUR' },
    };

    const flexibleBalanceItem = {
        ...balanceItem,
        wallet_id: 'wall_1',
        charge_on_demand_pricing_items: [
            {
                pricing_item_id: 'prii_flexible',
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_item: {
                    id: 'prii_flexible',
                    configs: [
                        {
                            id: 'pico_flexible',
                            on_demand: true,
                            details: {
                                pricing_type: 'FLEXIBLE',
                                bands: [
                                    {
                                        minimum_amount: { quantity: '10.00', currency: 'EUR' },
                                        maximum_amount: { quantity: '500.00', currency: 'EUR' },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    } as unknown as CustomerWalletBalanceItem;

    beforeEach(() => {
        vi.useFakeTimers();
        mockCreateAutoTopUp.mockReset();
        mockCreateAutoTopUp.mockResolvedValue({ id: 'atuc_1' });
        gateway.options.value = [{ id: 'pmo_card' }];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const saveRule = async (wrapper: ReturnType<typeof mountModal>) => {
        wrapper
            .findComponent({ name: 'TopUpModalForm' })
            .vm.$emit('save-auto-top-up', { rule: RULE, paymentMethodId: 'pmet_1' });
        await vi.runAllTimersAsync();
    };

    it('saves the rule as the API takes it', async () => {
        const wrapper = mountModal({ selectedBalanceItem: flexibleBalanceItem });

        await saveRule(wrapper);

        expect(mockCreateAutoTopUp).toHaveBeenCalledWith({
            wallet_id: 'wall_1',
            status: 'ACTIVE',
            threshold: RULE.threshold,
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_item_id: 'prii_flexible',
            payment_method_id: 'pmet_1',
            topup_amount: RULE.topup_amount,
        });
    });

    it('reports the saved rule so the balance showing it can be reloaded', async () => {
        const wrapper = mountModal({ selectedBalanceItem: flexibleBalanceItem });

        await saveRule(wrapper);

        expect(wrapper.emitted('auto-top-up-saved')).toHaveLength(1);
    });

    it('keeps quiet about a rule that fails to save, the charge having gone through', async () => {
        mockCreateAutoTopUp.mockRejectedValue(new Error('nope'));
        const wrapper = mountModal({ selectedBalanceItem: flexibleBalanceItem });

        await saveRule(wrapper);

        expect(wrapper.emitted('auto-top-up-saved')).toBeUndefined();
        expect(wrapper.emitted('failure')).toBeUndefined();
    });

    // A rule tops up by an amount of its own, which a wallet of fixed packs cannot charge.
    it('saves nothing for a wallet with no choose-your-amount top-up', async () => {
        const wrapper = mountModal();

        await saveRule(wrapper);

        expect(mockCreateAutoTopUp).not.toHaveBeenCalled();
    });
});

describe('TopUpModal — a wallet that already tops itself up', () => {
    const withRule = (configs: unknown[]) =>
        ({
            ...balanceItem,
            wallet: { auto_top_up_configs: configs },
        }) as unknown as CustomerWalletBalanceItem;

    beforeEach(() => {
        vi.useFakeTimers();
        gateway.options.value = [{ id: 'pmo_card' }];
        gateway.isPending.value = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const handedRule = (wrapper: ReturnType<typeof mountModal>) =>
        wrapper.findComponent({ name: 'TopUpModalForm' }).props('autoTopUpConfig');

    it('tells the form about the rule the wallet already runs on', () => {
        const wrapper = mountModal({
            selectedBalanceItem: withRule([
                {
                    id: 'atuc_1',
                    status: 'ACTIVE',
                    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
                    topup_amount: { quantity: '10.00', currency: 'EUR' },
                },
            ]),
        });

        expect(handedRule(wrapper)).toEqual({
            status: 'ACTIVE',
            threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
            topup_amount: { quantity: '10.00', currency: 'EUR' },
        });
    });

    it('ignores a rule that was switched off', () => {
        const wrapper = mountModal({
            selectedBalanceItem: withRule([{ id: 'atuc_1', status: 'INACTIVE', threshold: {} }]),
        });

        expect(handedRule(wrapper)).toBeUndefined();
    });

    it('tells the form nothing for a wallet that never had one', () => {
        expect(handedRule(mountModal())).toBeUndefined();
    });
});
