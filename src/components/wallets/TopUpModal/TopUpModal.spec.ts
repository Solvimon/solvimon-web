import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type {
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import TopUpModal from './TopUpModal.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockCharge, mockSubmitPaymentMethod, gateway } = vi.hoisted(() => ({
    mockCharge: vi.fn(),
    mockSubmitPaymentMethod: vi.fn(),
    // What the gateway offers this customer. Empty means nothing can be added at all. Held as a real
    // ref so the modal reacts to it arriving, the way it does against the live composable.
    gateway: {} as {
        options: { value: unknown[] };
        isPending: { value: boolean };
    },
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({
        previewChargeOnDemandPricingItems: vi.fn().mockResolvedValue({ id: 'inv_1' }),
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
            get: vi.fn(),
            isPending: gateway.isPending,
        }),
    };
});

// Starts up the Adyen and Stripe integrations, which have nothing to do with the modal's chrome.
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
        // The modal submits the form through its ref, so the stub has to answer to that too.
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
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: ['invoice', 'isCustomerFacing'],
            template: '<div data-testid="invoice-preview" />',
        }),
        // The real one reaches for solvimon-ui's own intl provider, which is not this modal's concern.
        // Stubbed down to the chrome the modal drives: the labels it sets and the two buttons.
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const customer = {
    id: 'cust_1',
    billing_address: { country_code: 'NL' },
} as unknown as Customer;

const credits = (quantity: string) => ({
    quantity,
    credit_type_id: 'ctyp_1',
    credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
});

/** A credit based wallet with one fixed top-up on offer: €10.00 for 1,000 coins. */
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** One stored card, so the modal takes its ordinary path: pick a top-up, pick a method, charge. */
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

/**
 * How far the track has slid, which is what says which pane is on screen. A step is a pane's width
 * plus the gap that keeps the neighbouring pane out of the viewport's sideways clip. The sliding
 * itself belongs to `SlidingPanes`, which has its own tests; this only says which pane the modal
 * asked for.
 */
const trackOffset = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.find<HTMLElement>('.sv-sliding-panes__track').element.style.transform;

const atStep = (index: number) =>
    index === 0 ? 'translateX(0px)' : `translateX(calc(${-index} * (100% + 1rem)))`;

/** The customer asks for the add-a-method step, which the top-up form hands up to the modal. */
const startAddingPaymentMethod = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.findComponent({ name: 'TopUpModalForm' }).vm.$emit('add-payment-method');
    await nextTick();
};

const selector = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'PaymentMethodSelectorStub' });

/** Choose the fixed top-up and confirm it, the way the customer would. */
const startCharge = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.find<HTMLInputElement>('input[type="radio"]').setValue();
    await wrapper.find('[data-testid="confirm"]').trigger('click');
    await nextTick();

    return wrapper;
};

/**
 * Charge the top-up and let the request come back: the form reports the invoice it got, and what was
 * added is read off the chosen pricing item.
 */
const chargeTopUp = async (wrapper: ReturnType<typeof mountModal>) => {
    await startCharge(wrapper);
    await vi.runAllTimersAsync();

    return wrapper;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

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

        // A credit based wallet, so the credits it grants rather than the €10.00 being charged.
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

    // ─── While the charge is out ───────────────────────────────────────────────

    it('shows the confirm button working while the charge is out', async () => {
        // Left hanging, so the modal is caught mid-charge.
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('isLoading')).toBe(true);
    });

    it('disables every input while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        // The chosen top-up and the payment method both settle the charge, so neither may move now.
        expect(wrapper.find<HTMLInputElement>('input[type="radio"]').element.disabled).toBe(true);
        expect(selector(wrapper).props('disabled')).toBe(true);
    });

    it('refuses to be cancelled while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = await startCharge(mountModal());

        await wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');

        // The money may already be on its way; the modal's own cancel button cannot be disabled, so
        // the close is refused instead of letting the customer walk away from a charge in flight.
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('lets go again once the charge comes back', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('isLoading')).toBe(false);
    });

    // ─── Success step ─────────────────────────────────────────────────────────

    it('slides on to the confirmation once the top-up is charged', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(trackOffset(wrapper)).toBe(atStep(2));
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });

    it('holds the charge back while the customer is still on the receipt', async () => {
        const wrapper = await chargeTopUp(mountModal());

        // Reporting it here would reload the balance under a receipt the customer is still reading.
        expect(wrapper.emitted('confirm')).toBeUndefined();
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('names what the top-up added to the balance', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.text()).toContain('Top-up successful');
        // Unseparated: the intl mock's formatNumber returns the raw quantity.
        expect(wrapper.text()).toContain('Your balance was topped up with 1000 coins.');
    });

    it('renames its chrome for the confirmation', async () => {
        const wrapper = await chargeTopUp(mountModal());

        expect(wrapper.text()).toContain('Top-up complete');
        expect(wrapper.text()).toContain('Your payment went through.');
    });

    it('offers only a way out once the money has been taken', async () => {
        const wrapper = await chargeTopUp(mountModal());

        // The modal's own footer always renders a cancel button beside the confirm one; there is
        // nothing to cancel here, so the confirmation replaces the footer with a single button.
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
        // has no cancel button — so this is the other way out of the step.
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
        // The form is rebuilt too — it is never unmounted, so it would otherwise hold the charged
        // state. Rebuilt, it opens on its pre-selected top-up, which prices itself straight away.
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

    it('says so in place of a selector there is nothing to fill', () => {
        const wrapper = mountEmpty();

        expect(wrapper.text()).toContain('No payment methods available');
        expect(selector(wrapper).exists()).toBe(false);
    });

    it('offers the selector again once the gateway has something', async () => {
        const wrapper = mountEmpty();
        expect(selector(wrapper).exists()).toBe(false);

        gateway.options.value = [{ id: 'pmo_card' }];
        await nextTick();

        // Back to the ordinary flow: the selector, and its own way of adding a method.
        expect(selector(wrapper).exists()).toBe(true);
        expect(wrapper.text()).not.toContain('No payment methods available');
    });

    it('leaves the selector in place when a method is stored, whatever the gateway offers', () => {
        const wrapper = mountModal();

        expect(selector(wrapper).exists()).toBe(true);
        expect(wrapper.text()).not.toContain('No payment methods available');
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

    // The options start out empty, so answering before they land would say "none available" on
    // every open and disable a confirm the customer can in fact use.
    it('waits for the options before saying there are none', async () => {
        gateway.options.value = [];
        gateway.isPending.value = true;

        const wrapper = mountModal({ paymentMethods: [] });

        expect(wrapper.text()).not.toContain('No payment methods available');
        expect(selector(wrapper).exists()).toBe(true);

        gateway.isPending.value = false;
        await nextTick();

        expect(wrapper.text()).toContain('No payment methods available');
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
    /** Two subscriptions, each carrying one of the schedules the wallet is topped up on. */
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

    /**
     * The subscription radios, told apart from the top-up ones by their id: the group builds ids
     * from its `name`, which it does not put on the inputs themselves.
     */
    const subscriptionRadios = (wrapper: ReturnType<typeof mountModal>) =>
        wrapper.findAll<HTMLInputElement>('input[id^="radio_top-up-subscription"]');

    /** The same wallet topped up on a schedule of each subscription. */
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

    // Drawn with the same component the checkout and cancellation modal use.
    it('draws each option as a subscription summary', () => {
        const wrapper = mountWithChoice();

        const summaries = wrapper.findAllComponents({ name: 'SubscriptionSummary' });

        expect(summaries).toHaveLength(2);
        expect(summaries.map((summary) => summary.props('subscription').id)).toEqual([
            'ppsu_1',
            'ppsu_2',
        ]);
    });

    // Only the name renders without them: the plan description is routinely empty.
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
