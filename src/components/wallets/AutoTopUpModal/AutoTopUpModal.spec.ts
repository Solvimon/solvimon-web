import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { Customer, CustomerWalletBalanceItem, PaymentMethod } from '@solvimon/solvimon-types';
import AutoTopUpModal from './AutoTopUpModal.vue';

const { mockCreate, mockPreview, mockAutoTopUp, mockSubmitPaymentMethod } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockPreview: vi.fn(),
    mockSubmitPaymentMethod: vi.fn(),
    mockAutoTopUp: { validate: vi.fn() } as {
        validate: ReturnType<typeof vi.fn>;
        rule: { value: unknown };
    },
}));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ createAutoTopUpConfig: mockCreate }),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ previewChargeOnDemandPricingItems: mockPreview }),
}));

vi.mock('@/composables/usePaymentMethodOptions', async () => {
    const { ref } = await import('vue');

    return {
        usePaymentMethodOptions: () => ({
            paymentMethodOptions: ref([{ id: 'pmo_card' }]),
            get: vi.fn(),
            isPending: ref(false),
        }),
    };
});

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.vue', async () => {
    const { ref } = await import('vue');

    mockAutoTopUp.rule = ref<unknown>(undefined);

    return {
        default: defineComponent({
            name: 'AutoTopUpConfigStub',
            props: {
                config: Object,
                denomination: Object,
                creditUnitName: String,
                chargeCurrency: String,
                alwaysEnabled: Boolean,
                disabled: Boolean,
            },
            setup(_props, { expose }) {
                expose({ validate: mockAutoTopUp.validate, rule: mockAutoTopUp.rule });

                return () => null;
            },
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
        props: ['modelValue', 'paymentMethods', 'label', 'disabled', 'error'],
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
        // The real one reaches for solvimon-ui's own intl provider, which is not this modal's
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
                    <button type="button" data-testid="cancel" @click="$emit('close')">
                        {{ cancelButtonText }}
                    </button>
                    <button type="button" data-testid="confirm" @click="$emit('confirm')">
                        {{ confirmButtonText }}
                    </button>
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

const THRESHOLD = { amount: { quantity: '5.00', currency: 'EUR' } };
const TOP_UP_AMOUNT = { quantity: '10.00', currency: 'EUR' };

const walletBalanceItem = {
    wallet_id: 'wall_1',
    wallet_type_id: 'wtyp_1',
    wallet_balance: { open_balance: { amount: { quantity: '25.00', currency: 'EUR' } } },
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

const topUpItem = {
    pricing_item_id: 'prii_flexible',
    pricing_plan_schedule_id: 'ppsc_1',
} as never;

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(AutoTopUpModal, {
        props: {
            showModal: true,
            customer,
            walletBalanceItem,
            topUpItem,
            paymentMethods: [storedPaymentMethod],
            ...props,
        },
        attachTo: document.body,
    });

const editor = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'AutoTopUpConfigStub' });

const selector = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findComponent({ name: 'PaymentMethodSelectorStub' });

const confirm = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.find('[data-testid="confirm"]').trigger('click');
    await nextTick();
};

describe('AutoTopUpModal', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockCreate.mockResolvedValue({ id: 'atuc_1' });
        mockSubmitPaymentMethod.mockReset();
        mockPreview.mockReset();
        mockPreview.mockResolvedValue({ id: 'inv_preview' });
        mockAutoTopUp.rule.value = undefined;
        mockAutoTopUp.validate.mockReset();
        mockAutoTopUp.validate.mockReturnValue({
            status: 'ACTIVE',
            threshold: THRESHOLD,
            topup_amount: TOP_UP_AMOUNT,
        });
    });

    it('asks for the rule in what the wallet is topped up in', () => {
        const wrapper = mountModal();

        expect(editor(wrapper).props('denomination')).toEqual({ currency: 'EUR' });
        expect(editor(wrapper).props('chargeCurrency')).toBe('EUR');
    });

    it('leaves the on/off switch out of the rule editor', () => {
        expect(editor(mountModal()).props('alwaysEnabled')).toBe(true);
    });

    it('names the balance the threshold is compared against', () => {
        expect(mountModal().text()).toContain('25.00');
    });

    it('opens on the rule the wallet already has', () => {
        const wrapper = mountModal({
            walletBalanceItem: {
                ...walletBalanceItem,
                wallet: {
                    auto_top_up_configs: [
                        {
                            id: 'atuc_1',
                            status: 'ACTIVE',
                            threshold: THRESHOLD,
                            topup_amount: TOP_UP_AMOUNT,
                            payment_method_id: 'pmet_1',
                        },
                    ],
                },
            },
        });

        expect(editor(wrapper).props('config')).toEqual({
            status: 'ACTIVE',
            threshold: THRESHOLD,
            topup_amount: TOP_UP_AMOUNT,
        });
    });

    it('opens on the method the rule already charges', () => {
        const wrapper = mountModal({
            paymentMethods: [storedPaymentMethod, { ...storedPaymentMethod, id: 'pmet_2' }],
            walletBalanceItem: {
                ...walletBalanceItem,
                wallet: {
                    auto_top_up_configs: [
                        { status: 'ACTIVE', threshold: THRESHOLD, payment_method_id: 'pmet_2' },
                    ],
                },
            },
        });

        expect(selector(wrapper).props('modelValue')).toBe('pmet_2');
    });

    it("opens on the customer's default method when the wallet has no rule yet", () => {
        const wrapper = mountModal({
            paymentMethods: [
                storedPaymentMethod,
                { ...storedPaymentMethod, id: 'pmet_default', is_default: true },
            ],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pmet_default');
    });

    it('saves the rule as the API takes it', async () => {
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(mockCreate).toHaveBeenCalledWith({
            wallet_id: 'wall_1',
            status: 'ACTIVE',
            threshold: THRESHOLD,
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_item_id: 'prii_flexible',
            payment_method_id: 'pmet_1',
            topup_amount: TOP_UP_AMOUNT,
        });
    });

    it('reports the rule and closes once it is saved', async () => {
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(wrapper.emitted('saved')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('stays open and reports the failure when saving fails', async () => {
        mockCreate.mockRejectedValue(new Error('nope'));
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(wrapper.emitted('saved')).toBeUndefined();
        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.emitted('payment-failed')).toHaveLength(1);
    });

    it('saves nothing while the rule does not validate', async () => {
        mockAutoTopUp.validate.mockReturnValue(undefined);
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('faults a missing payment method rather than sending the rule', async () => {
        const wrapper = mountModal({ paymentMethods: [] });

        await confirm(wrapper);

        expect(mockCreate).not.toHaveBeenCalled();
        expect(selector(wrapper).props('error')).not.toHaveLength(0);
    });

    describe('invoice preview', () => {
        // The preview is debounced, so the timers are driven rather than waited on.
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        const enterAmount = async (wrapper: ReturnType<typeof mountModal>) => {
            mockAutoTopUp.rule.value = {
                status: 'ACTIVE',
                threshold: THRESHOLD,
                topup_amount: TOP_UP_AMOUNT,
            };
            await nextTick();
            await vi.runAllTimersAsync();
            await nextTick();

            return wrapper;
        };

        it('prices nothing while no amount has been entered', async () => {
            const wrapper = mountModal();
            await vi.runAllTimersAsync();

            expect(mockPreview).not.toHaveBeenCalled();
            expect(wrapper.findComponent({ name: 'InvoicePreviewStub' }).exists()).toBe(false);
        });

        it('prices what an automatic top-up would charge', async () => {
            const wrapper = await enterAmount(mountModal());

            expect(mockPreview).toHaveBeenCalledWith({
                pricingPlanScheduleId: 'ppsc_1',
                pricingItems: [
                    { pricing_item_id: 'prii_flexible', flexible_amount: TOP_UP_AMOUNT },
                ],
            });
            expect(wrapper.findComponent({ name: 'InvoicePreviewStub' }).exists()).toBe(true);
        });

        it('shows the invoice once it comes back', async () => {
            const wrapper = await enterAmount(mountModal());

            expect(wrapper.findComponent({ name: 'InvoicePreviewStub' }).props('invoice')).toEqual({
                id: 'inv_preview',
            });
        });
    });

    it('steps over to the payment method form when one is asked for', async () => {
        const wrapper = mountModal();

        selector(wrapper).vm.$emit('add-payment-method');
        await flushPromises();

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(true);
    });

    it('submits the payment method form when confirmed while adding one', async () => {
        const wrapper = mountModal();

        selector(wrapper).vm.$emit('add-payment-method');
        await flushPromises();
        await confirm(wrapper);

        expect(mockSubmitPaymentMethod).toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('steps back to the rule rather than closing when cancelled while adding', async () => {
        const wrapper = mountModal();

        selector(wrapper).vm.$emit('add-payment-method');
        await nextTick();
        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('closes when cancelled on the rule itself', async () => {
        const wrapper = mountModal();

        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('builds the payment method form only once it is asked for', () => {
        const wrapper = mountModal();

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(false);
    });

    it('asks nothing of a wallet that cannot say what its rule is written in', () => {
        const wrapper = mountModal({
            walletBalanceItem: { ...walletBalanceItem, charge_on_demand_pricing_items: [] },
        });

        expect(editor(wrapper).exists()).toBe(false);
    });
});
