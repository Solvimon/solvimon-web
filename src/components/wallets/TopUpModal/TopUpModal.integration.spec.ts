import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type {
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import TopUpModal from './TopUpModal.vue';
import { ApiError } from '@/services/apiError';

/**
 * The top-up modal with its real form, amount input and auto top-up editor, so what is typed and
 * toggled reaches the charge the way a customer's input would.
 */

const { mockCharge, mockCreateAutoTopUp, mockPreview, gateway } = vi.hoisted(() => ({
    mockCharge: vi.fn(),
    mockCreateAutoTopUp: vi.fn(),
    mockPreview: vi.fn(),
    gateway: {} as { options: { value: unknown[] }; isPending: { value: boolean } },
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
            get: vi.fn(),
            isPending: gateway.isPending,
        }),
    };
});

vi.mock('@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodSelectorStub',
        props: ['modelValue', 'paymentMethods', 'label', 'required', 'disabled', 'error'],
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
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div>{{ title }}</div>',
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

const customer = { id: 'cust_1', billing_address: { country_code: 'NL' } } as unknown as Customer;

const storedPaymentMethod = {
    id: 'pmet_1',
    type: 'CARD',
    status: 'ACTIVE',
    card: { brand: 'VISA', last_four_digits: '4242' },
} as unknown as PaymentMethod;

const credits = (quantity: string) => ({
    quantity,
    credit_type_id: 'ctyp_1',
    credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
});

const flexibleEntry = ({
    pricingItemId = 'prii_flexible',
    scheduleId = 'ppsc_1',
    currency = 'EUR',
    minimum = '10.00',
    maximum = '100.00',
    rate,
}: {
    pricingItemId?: string;
    scheduleId?: string;
    currency?: string;
    minimum?: string | null;
    maximum?: string | null;
    rate?: string;
}) => ({
    pricing_item_id: pricingItemId,
    pricing_plan_schedule_id: scheduleId,
    pricing_item: {
        id: pricingItemId,
        configs: [
            {
                id: `${pricingItemId}_config`,
                on_demand: true,
                details: {
                    pricing_type: 'FLEXIBLE',
                    bands: [
                        {
                            ...(minimum && { minimum_amount: { quantity: minimum, currency } }),
                            ...(maximum && { maximum_amount: { quantity: maximum, currency } }),
                        },
                    ],
                },
                wallet_grants: [
                    {
                        wallet_type_id: 'wtyp_1',
                        ...(rate && {
                            credits_grant: { conversion: { credit_type_id: 'ctyp_1', rate } },
                        }),
                    },
                ],
            },
        ],
    },
});

const fixedEntry = (scheduleId = 'ppsc_1') => ({
    pricing_item_id: 'prii_fixed',
    pricing_plan_schedule_id: scheduleId,
    pricing_item: {
        id: 'prii_fixed',
        configs: [
            {
                id: 'pico_fixed',
                on_demand: true,
                details: {
                    pricing_type: 'FIXED',
                    bands: [{ fixed_amount: { quantity: '25.00', currency: 'EUR' } }],
                },
                wallet_grants: [{ wallet_type_id: 'wtyp_1' }],
            },
        ],
    },
});

const moneyWallet = (entries: unknown[] = [flexibleEntry({}), fixedEntry()]) =>
    ({
        wallet_id: 'wall_1',
        wallet_type_id: 'wtyp_1',
        wallet_balance: {
            open_balance: { amount: { quantity: '50.00', currency: 'EUR' } },
            balance: { amount: { quantity: '50.00', currency: 'EUR' } },
        },
        charge_on_demand_pricing_items: entries,
    }) as unknown as CustomerWalletBalanceItem;

const creditsWallet = (entries: unknown[] = [flexibleEntry({ rate: '3' })]) =>
    ({
        wallet_id: 'wall_1',
        wallet_type_id: 'wtyp_1',
        wallet_balance: {
            open_balance: { credits: credits('500') },
            balance: { credits: credits('500') },
        },
        charge_on_demand_pricing_items: entries,
    }) as unknown as CustomerWalletBalanceItem;

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(TopUpModal, {
        props: {
            showModal: true,
            customer,
            selectedBalanceItem: moneyWallet(),
            paymentMethods: [storedPaymentMethod],
            ...props,
        },
        attachTo: document.body,
    });

type Wrapper = ReturnType<typeof mountModal>;

const settle = async () => {
    await vi.runAllTimersAsync();
    await flushPromises();
};

const amountInput = (wrapper: Wrapper) =>
    wrapper.find<HTMLInputElement>('input[name="top-up-amount"]');

const typeAmount = async (wrapper: Wrapper, value: string) => {
    await amountInput(wrapper).setValue(value);
    await settle();
};

const amountErrors = (wrapper: Wrapper): string[] => {
    const field = wrapper
        .findAllComponents({ name: 'ConvertedAmountInput' })
        .find((input) => input.props('name') === 'top-up-amount');
    const errors = (field?.props('error') ?? []) as { $message: string }[];

    return errors.map(({ $message }) => String($message));
};

const pay = async (wrapper: Wrapper) => {
    await wrapper.find('[data-testid="confirm"]').trigger('click');
    await settle();
};

const chargedItems = () => mockCharge.mock.calls.at(-1)?.[0];

const topUpError = (wrapper: Wrapper) => wrapper.find('.sv-topup-modal__error');

beforeEach(() => {
    vi.useFakeTimers();
    mockCharge.mockReset();
    mockCharge.mockResolvedValue({ id: 'inv_charged' });
    mockCreateAutoTopUp.mockReset();
    mockCreateAutoTopUp.mockResolvedValue({ id: 'atuc_1' });
    mockPreview.mockReset();
    mockPreview.mockResolvedValue({ id: 'inv_preview' });
    gateway.options.value = [{ id: 'pmo_card' }];
    gateway.isPending.value = false;
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('TopUpModal (integrated) — the amount typed into a money wallet', () => {
    it.each([
        ['', 'Enter the amount to top up with.'],
        ['0', 'Top up with more than zero.'],
        ['-5', 'Top up with more than zero.'],
        ['9.99', 'Top up with at least'],
        ['100.01', 'Top up with at most'],
    ])('refuses %p and says why', async (typed, message) => {
        const wrapper = mountModal();
        await settle();

        await typeAmount(wrapper, typed);
        await pay(wrapper);

        expect(mockCharge).not.toHaveBeenCalled();
        expect(amountErrors(wrapper).join(' ')).toContain(message);
    });

    it('puts the reason on the page, not only on the field', async () => {
        const wrapper = mountModal();
        await settle();

        await typeAmount(wrapper, '9.99');
        await pay(wrapper);

        expect(wrapper.text()).toContain('Top up with at least');
    });

    it('charges an amount inside the bounds', async () => {
        const wrapper = mountModal();
        await settle();

        await typeAmount(wrapper, '50');
        await pay(wrapper);

        expect(chargedItems()).toMatchObject({
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_items: [
                {
                    pricing_item_id: 'prii_flexible',
                    flexible_amount: { quantity: '50', currency: 'EUR' },
                },
            ],
        });
    });

    it('charges a fixed pack chosen while the amount field holds something out of range', async () => {
        const wrapper = mountModal();
        await settle();
        await typeAmount(wrapper, '-3');

        await wrapper.find<HTMLInputElement>('input[type="radio"][value="prii_fixed"]').setValue();
        await settle();
        await pay(wrapper);

        expect(chargedItems()).toMatchObject({
            pricing_items: [{ pricing_item_id: 'prii_fixed' }],
        });
        expect(chargedItems().pricing_items[0]).not.toHaveProperty('flexible_amount');
    });
});

describe('TopUpModal (integrated) — the amount typed into a credits wallet', () => {
    it.each([
        ['', 'Enter the amount to top up with.'],
        ['0', 'Top up with more than zero.'],
        ['-30', 'Top up with more than zero.'],
        ['29', 'Top up with at least 30'],
        ['301', 'Top up with at most 300'],
    ])('refuses %p credits and says why in credits', async (typed, message) => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();

        await typeAmount(wrapper, typed);
        await pay(wrapper);

        expect(mockCharge).not.toHaveBeenCalled();
        expect(amountErrors(wrapper).join(' ')).toContain(message);
    });

    it('never charges less than the minimum, however the credits round', async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();

        await typeAmount(wrapper, '29.99');
        await pay(wrapper);

        const charged = Number(chargedItems()?.pricing_items[0].flexible_amount.quantity);
        expect(charged).toBeGreaterThanOrEqual(10);
    });

    it('never charges more than the maximum, however the credits round', async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();

        await typeAmount(wrapper, '300.01');
        await pay(wrapper);

        const quantity = chargedItems()?.pricing_items[0].flexible_amount.quantity;
        expect(quantity === undefined || Number(quantity) <= 100).toBe(true);
    });

    it.each([
        ['EUR', '100', '33.33'],
        ['JPY', '1000', '333'],
        ['KWD', '100', '33.333'],
    ])('charges %s in its own minor units', async (currency, typed, charged) => {
        const wrapper = mountModal({
            selectedBalanceItem: creditsWallet([
                flexibleEntry({ rate: '3', currency, minimum: '1', maximum: '100000' }),
            ]),
        });
        await settle();

        await typeAmount(wrapper, typed);
        await pay(wrapper);

        expect(chargedItems()?.pricing_items[0].flexible_amount).toEqual({
            quantity: charged,
            currency,
        });
    });
});

describe('TopUpModal (integrated) — a charge that fails', () => {
    it('tells a declined payment from a failed request, and lets Pay through again', async () => {
        mockCharge
            .mockRejectedValueOnce(new ApiError({ statusCode: 422, resourceType: 'PAYMENT' }))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const wrapper = mountModal();
        await settle();
        await typeAmount(wrapper, '50');

        await pay(wrapper);
        const declined = topUpError(wrapper).text();

        await pay(wrapper);
        const failed = topUpError(wrapper).text();

        expect(mockCharge).toHaveBeenCalledTimes(2);
        expect(declined).toContain('Your payment was declined');
        expect(failed).toContain("We couldn't top up your wallet");
        expect(wrapper.emitted('payment-failed')).toHaveLength(2);
    });

    it('drops the message once the modal is opened again', async () => {
        mockCharge.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const wrapper = mountModal();
        await settle();
        await typeAmount(wrapper, '50');
        await pay(wrapper);
        expect(topUpError(wrapper).exists()).toBe(true);

        await wrapper.setProps({ showModal: false });
        await wrapper.setProps({ showModal: true });
        await settle();

        expect(topUpError(wrapper).exists()).toBe(false);
    });

    it('drops the message while the retry is under way', async () => {
        mockCharge
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockReturnValueOnce(new Promise(() => {}));
        const wrapper = mountModal();
        await settle();
        await typeAmount(wrapper, '50');
        await pay(wrapper);
        expect(topUpError(wrapper).exists()).toBe(true);

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await nextTick();

        expect(topUpError(wrapper).exists()).toBe(false);
    });
});

describe('TopUpModal (integrated) — an auto top-up rule switched off again', () => {
    const toggle = (wrapper: Wrapper) =>
        wrapper.find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]');

    const typeRule = async (wrapper: Wrapper, threshold: string, amount: string) => {
        await wrapper.find('input[name="auto-top-up-threshold"]').setValue(threshold);
        await wrapper.find('input[name="auto-top-up-amount"]').setValue(amount);
        await settle();
    };

    const switchedOffWithBadValues = async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();
        await typeAmount(wrapper, '60');
        await toggle(wrapper).setValue(true);
        await settle();
        await typeRule(wrapper, '-5', '1');
        await toggle(wrapper).setValue(false);
        await settle();

        return wrapper;
    };

    it('does not hold the top-up back', async () => {
        const wrapper = await switchedOffWithBadValues();

        await pay(wrapper);

        expect(mockCharge).toHaveBeenCalledTimes(1);
    });

    it('holds it back again once the rule is switched back on', async () => {
        const wrapper = await switchedOffWithBadValues();

        await toggle(wrapper).setValue(true);
        await settle();
        await pay(wrapper);

        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('saves no rule the customer switched off', async () => {
        const wrapper = await switchedOffWithBadValues();

        await pay(wrapper);

        expect(mockCharge).toHaveBeenCalledTimes(1);
        expect(mockCreateAutoTopUp).not.toHaveBeenCalled();
    });

    it('says nothing about a rule on the receipt when it was switched off', async () => {
        mockCreateAutoTopUp.mockRejectedValue(
            new ApiError({ statusCode: 400, field: 'topup_amount' }),
        );
        const wrapper = await switchedOffWithBadValues();

        await pay(wrapper);

        expect(wrapper.find('.sv-topup-modal__auto-top-up-error').exists()).toBe(false);
    });
});

describe('TopUpModal (integrated) — a wallet shared by subscriptions on different schedules', () => {
    const subscriptionOn = (id: string, name: string, scheduleId: string) => ({
        id,
        name,
        pricing_plan_schedule_infos: [
            { id: scheduleId, pricing_plan_schedule: { enabled_pricings: [] } },
        ],
    });

    const subscriptions = [
        subscriptionOn('ppsu_1', 'Pro plan', 'ppsc_1'),
        subscriptionOn('ppsu_2', 'Add-on', 'ppsc_2'),
    ] as unknown as PricingPlanSubscriptionExpanded[];

    const sharedWallet = () =>
        creditsWallet([
            flexibleEntry({ rate: '3', scheduleId: 'ppsc_1', pricingItemId: 'prii_one' }),
            flexibleEntry({ rate: '3', scheduleId: 'ppsc_2', pricingItemId: 'prii_two' }),
        ]);

    it('charges, previews and saves the rule on the chosen subscription’s schedule', async () => {
        const wrapper = mountModal({ selectedBalanceItem: sharedWallet(), subscriptions });
        await settle();

        await wrapper
            .findAll<HTMLInputElement>('input[id^="radio_top-up-subscription"]')[1]
            .setValue();
        await settle();
        await typeAmount(wrapper, '60');
        await wrapper
            .find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]')
            .setValue(true);
        await settle();
        await wrapper.find('input[name="auto-top-up-threshold"]').setValue('10');
        await wrapper.find('input[name="auto-top-up-amount"]').setValue('60');
        await settle();
        await pay(wrapper);

        expect(mockPreview.mock.calls.at(-1)?.[0]).toMatchObject({
            pricingPlanScheduleId: 'ppsc_2',
        });
        expect(chargedItems()).toMatchObject({
            pricing_plan_schedule_id: 'ppsc_2',
            pricing_items: [{ pricing_item_id: 'prii_two' }],
        });
        expect(mockCreateAutoTopUp.mock.calls[0]?.[0]).toMatchObject({
            pricing_plan_schedule_id: 'ppsc_2',
            pricing_item_id: 'prii_two',
        });
    });

    it('charges and saves the rule on the chosen item’s schedule when no subscriptions narrow the items', async () => {
        const wrapper = mountModal({ selectedBalanceItem: sharedWallet() });
        await settle();

        await wrapper.find<HTMLInputElement>('input[type="radio"][value="prii_two"]').setValue();
        await settle();
        await typeAmount(wrapper, '60');
        await wrapper
            .find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]')
            .setValue(true);
        await settle();
        await wrapper.find('input[name="auto-top-up-threshold"]').setValue('10');
        await wrapper.find('input[name="auto-top-up-amount"]').setValue('60');
        await settle();
        await pay(wrapper);

        expect(mockPreview.mock.calls.at(-1)?.[0]).toMatchObject({
            pricingPlanScheduleId: 'ppsc_2',
        });
        expect(chargedItems()).toMatchObject({
            pricing_plan_schedule_id: 'ppsc_2',
            pricing_items: [{ pricing_item_id: 'prii_two' }],
        });
        expect(mockCreateAutoTopUp.mock.calls[0]?.[0]).toMatchObject({
            pricing_plan_schedule_id: 'ppsc_2',
            pricing_item_id: 'prii_two',
        });
    });
});

describe('TopUpModal (integrated, round 2) — the amount field as the customer reads it', () => {
    const bounds = (wrapper: Wrapper) => wrapper.find('[data-testid="top-up-amount-bounds"]');

    it.each([
        ['both bounds', { minimum: '10.00', maximum: '100.00' }, 'Between 10.00 and 100.00 EUR'],
        ['a minimum only', { minimum: '10.00', maximum: null }, 'At least 10.00 EUR'],
        ['a maximum only', { minimum: null, maximum: '100.00' }, 'Up to 100.00 EUR'],
    ])('states %s beside the label of a money wallet', async (_case, range, text) => {
        const wrapper = mountModal({
            selectedBalanceItem: moneyWallet([flexibleEntry(range)]),
        });
        await settle();

        expect(wrapper.text()).toContain('Amount');
        expect(bounds(wrapper).text()).toBe(text);
    });

    it('states the bounds in credits for a credits wallet', async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();

        expect(bounds(wrapper).text()).toBe('Between 30 and 300 coins');
    });

    it('states no range for a pricing without bounds, and still charges what is typed', async () => {
        const wrapper = mountModal({
            selectedBalanceItem: moneyWallet([
                flexibleEntry({ minimum: null, maximum: null }),
                fixedEntry(),
            ]),
        });
        await settle();

        expect(bounds(wrapper).exists()).toBe(false);
        expect(amountInput(wrapper).exists()).toBe(true);

        await typeAmount(wrapper, '12.50');
        await pay(wrapper);

        expect(chargedItems()?.pricing_items[0].flexible_amount?.quantity).toBe('12.50');
    });

    it('marks the field invalid only once the customer has got it wrong', async () => {
        const wrapper = mountModal();
        await settle();
        expect(amountInput(wrapper).attributes('aria-invalid')).toBeUndefined();

        await typeAmount(wrapper, '5');
        await pay(wrapper);

        expect(amountInput(wrapper).attributes('aria-invalid')).toBe('true');
        expect(wrapper.text()).toContain('Top up with at least');

        await typeAmount(wrapper, '50');

        expect(amountInput(wrapper).attributes('aria-invalid')).toBeUndefined();
    });

    it('does not mark the rule fields invalid when the rule is switched on, before anything is typed', async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();

        await wrapper
            .find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]')
            .setValue(true);
        await settle();

        for (const name of ['auto-top-up-threshold', 'auto-top-up-amount']) {
            expect(
                wrapper.find(`input[name="${name}"]`).attributes('aria-invalid'),
            ).toBeUndefined();
        }
    });
});

describe('TopUpModal (integrated, round 2) — a rule still being saved', () => {
    let settleSave: (fail: boolean) => void;

    beforeEach(() => {
        mockCreateAutoTopUp.mockReset();
        mockCreateAutoTopUp.mockReturnValue(
            new Promise((resolve, reject) => {
                settleSave = (fail) => (fail ? reject(new Error('nope')) : resolve({ id: 'a' }));
            }),
        );
    });

    const chargedWithRule = async () => {
        const wrapper = mountModal({ selectedBalanceItem: creditsWallet() });
        await settle();
        await typeAmount(wrapper, '60');
        await wrapper
            .find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]')
            .setValue(true);
        await settle();
        await wrapper.find('input[name="auto-top-up-threshold"]').setValue('10');
        await wrapper.find('input[name="auto-top-up-amount"]').setValue('60');
        await settle();
        await pay(wrapper);
        expect(mockCreateAutoTopUp).toHaveBeenCalledTimes(1);

        return wrapper;
    };

    const closeCross = (wrapper: Wrapper) =>
        wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');

    it('cannot be left by Done or by the close cross while the save is out', async () => {
        const wrapper = await chargedWithRule();

        await wrapper.find('[data-testid="done"]').trigger('click');
        closeCross(wrapper);
        await nextTick();

        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.emitted('confirm')).toBeUndefined();
        expect(wrapper.findComponent({ name: 'ModalStub' }).props('isLoading')).toBe(true);
    });

    it('shows a failure that comes back during the same opening', async () => {
        const wrapper = await chargedWithRule();

        settleSave(true);
        await settle();

        expect(wrapper.find('.sv-topup-modal__auto-top-up-error').exists()).toBe(true);
        await wrapper.find('[data-testid="done"]').trigger('click');
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    // Characterisation, not a defect pinned: requests have no timeout, so a save that never
    // answers keeps the receipt behind the loading overlay with no way out but a reload. A
    // charge that never answers already did the same on main.
    it('stays shut for as long as a save goes unanswered', async () => {
        const wrapper = await chargedWithRule();

        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        closeCross(wrapper);
        await wrapper.find('[data-testid="done"]').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
    });
});

describe('TopUpModal (integrated, round 2) — a wallet whose only rule is switched off', () => {
    const withInactiveRule = () => {
        const wallet = creditsWallet() as unknown as Record<string, unknown>;

        return {
            ...wallet,
            wallet: {
                id: 'wall_1',
                wallet_type_id: 'wtyp_1',
                auto_top_up_configs: [
                    {
                        id: 'atuc_old',
                        status: 'INACTIVE',
                        threshold: { credits: credits('5') },
                        topup_amount: { quantity: '20.00', currency: 'EUR' },
                        pricing_item_id: 'prii_flexible',
                        pricing_plan_schedule_id: 'ppsc_1',
                        payment_method_id: 'pmet_1',
                    },
                ],
            },
        } as unknown as CustomerWalletBalanceItem;
    };

    const toggle = (wrapper: Wrapper) =>
        wrapper.find<HTMLInputElement>('.sv-top-up-form__auto-top-up input[type="checkbox"]');

    it('offers the editor, switched off, and sends nothing when it is left off', async () => {
        const wrapper = mountModal({ selectedBalanceItem: withInactiveRule() });
        await settle();

        expect(toggle(wrapper).exists()).toBe(true);
        expect(toggle(wrapper).element.checked).toBe(false);

        await typeAmount(wrapper, '60');
        await pay(wrapper);

        expect(mockCharge).toHaveBeenCalledTimes(1);
        expect(mockCreateAutoTopUp).not.toHaveBeenCalled();
    });

    it('creates a new ACTIVE rule when switched on, never a deactivation', async () => {
        const wrapper = mountModal({ selectedBalanceItem: withInactiveRule() });
        await settle();
        await typeAmount(wrapper, '60');
        await toggle(wrapper).setValue(true);
        await settle();
        await wrapper.find('input[name="auto-top-up-threshold"]').setValue('10');
        await wrapper.find('input[name="auto-top-up-amount"]').setValue('60');
        await settle();

        await pay(wrapper);

        expect(mockCreateAutoTopUp).toHaveBeenCalledTimes(1);
        expect(mockCreateAutoTopUp.mock.calls[0]?.[0]).toMatchObject({
            status: 'ACTIVE',
            wallet_id: 'wall_1',
        });
    });
});
