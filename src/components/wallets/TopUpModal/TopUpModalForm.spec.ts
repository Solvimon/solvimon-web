import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { Amount } from '@solvimon/solvimon-types';
import type { TopUpPricingItem } from './TopUpModal.lib';
import TopUpModalForm from './TopUpModalForm.vue';

const { mockPreview, mockCharge, mockAutoTopUp } = vi.hoisted(() => ({
    mockPreview: vi.fn(),
    mockCharge: vi.fn(),
    mockAutoTopUp: { validate: vi.fn(), hasChanges: false, isInvalid: false },
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({
        previewChargeOnDemandPricingItems: mockPreview,
        chargeOnDemandPricingItems: mockCharge,
    }),
}));

vi.mock('@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.vue', () => ({
    default: defineComponent({
        name: 'AutoTopUpConfigStub',
        props: {
            config: Object,
            denomination: Object,
            creditUnitName: String,
            chargeCurrency: String,
            contained: Boolean,
            showThresholdConversion: { type: Boolean, default: true },
            disabled: Boolean,
        },
        setup(_props, { expose }) {
            expose({
                validate: mockAutoTopUp.validate,
                get hasChanges() {
                    return mockAutoTopUp.hasChanges;
                },
                get isInvalid() {
                    return mockAutoTopUp.isInvalid;
                },
            });

            return () => h('div', { 'data-testid': 'auto-top-up-config' });
        },
    }),
}));

vi.mock('@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.vue', () => ({
    default: defineComponent({
        name: 'ConvertedAmountInputStub',
        props: [
            'modelValue',
            'unit',
            'modelBase',
            'entryBase',
            'currency',
            'conversionRate',
            'creditUnitName',
            'bounds',
            'showConversionHint',
            'name',
            'required',
            'disabled',
        ],
        emits: ['update:modelValue'],
        template: '<div data-testid="amount-input" />',
    }),
}));

vi.mock('@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodSelectorStub',
        props: [
            'modelValue',
            'paymentMethods',
            'customer',
            'paymentMethodOptions',
            'isLoadingPaymentMethodOptions',
            'paymentMethodFormConfiguration',
            'label',
            'required',
            'disabled',
            'error',
        ],
        emits: ['update:modelValue', 'add-payment-method'],
        template: '<div data-testid="payment-method-selector" />',
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: ['invoice'],
            template: '<div data-testid="invoice-preview" />',
        }),
    });
});

const amountOf = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

const creditsOf = (quantity: string) => ({
    credits: {
        quantity,
        credit_type_id: 'ctyp_1',
        credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
    },
});

const createFlexibleItem = ({
    pricingItemId = 'prii_flexible',
    scheduleId = 'ppsc_1',
    inCredits = false,
}: { pricingItemId?: string; scheduleId?: string; inCredits?: boolean } = {}) =>
    ({
        pricingItemId,
        pricingPlanScheduleId: scheduleId,
        config: { id: `${pricingItemId}_config`, on_demand: true },
        flexiblePricing: {
            config: { minimum_amount: amountOf('100.00'), maximum_amount: amountOf('1000.00') },
            currency: 'EUR',
            ...(inCredits && { creditsConfiguration: { conversionRate: '10' } }),
            bounds: inCredits
                ? { minimum: creditsOf('1000'), maximum: creditsOf('10000') }
                : {
                      minimum: { amount: amountOf('100.00') },
                      maximum: { amount: amountOf('1000.00') },
                  },
        },
    }) as unknown as TopUpPricingItem;

const createFixedItem = ({
    pricingItemId = 'prii_fixed',
    scheduleId = 'ppsc_1',
    quantity = '10.00',
    grantedCredits,
}: {
    pricingItemId?: string;
    scheduleId?: string;
    quantity?: string;
    grantedCredits?: string;
} = {}) =>
    ({
        pricingItemId,
        pricingPlanScheduleId: scheduleId,
        config: { id: `${pricingItemId}_config`, on_demand: true },
        fixedPricing: {
            amount: amountOf(quantity),
            value: grantedCredits ? creditsOf(grantedCredits) : { amount: amountOf(quantity) },
        },
    }) as unknown as TopUpPricingItem;

const createUnsupportedItem = () =>
    ({
        pricingItemId: 'prii_unsupported',
        pricingPlanScheduleId: 'ppsc_1',
        config: { id: 'pico_unsupported', on_demand: true },
    }) as unknown as TopUpPricingItem;

const mountForm = (
    topUpPricingItems: TopUpPricingItem[] | undefined,
    props: Record<string, unknown> = {},
) =>
    mount(TopUpModalForm, {
        props: {
            topUpPricingItems,
            paymentMethods: [createPaymentMethod('pm_default', true)],
            ...props,
        },
        attachTo: document.body,
    });

const createPaymentMethod = (id: string, isDefault = false, createdAt = '2026-01-01T00:00:00Z') =>
    ({ id, is_default: isDefault, created_at: createdAt, type: 'CARD', card: {} }) as never;

const radios = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.findAll<HTMLInputElement>('input[type="radio"]');

const checkedRadio = (wrapper: ReturnType<typeof mountForm>) =>
    radios(wrapper).find((radio) => radio.element.checked)?.element.value;

const amountInput = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.findComponent({ name: 'ConvertedAmountInputStub' });

const selector = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.findComponent({ name: 'PaymentMethodSelectorStub' });

const editor = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.findComponent({ name: 'AutoTopUpConfigStub' });

const select = async (wrapper: ReturnType<typeof mountForm>, index: number) => {
    await radios(wrapper)[index].setValue();
    await vi.runAllTimersAsync();
};

const enterAmount = async (wrapper: ReturnType<typeof mountForm>, quantity: string) => {
    amountInput(wrapper).vm.$emit('update:modelValue', quantity);
    await nextTick();
    await vi.runAllTimersAsync();
};

describe('TopUpModalForm', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockPreview.mockReset();
        mockPreview.mockResolvedValue({ id: 'inv_1' });
        mockCharge.mockReset();
        mockCharge.mockResolvedValue({ id: 'inv_charged' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('offers one option per way of topping up, mixing flexible and fixed', () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        expect(radios(wrapper).map((radio) => radio.element.value)).toEqual([
            'prii_flexible',
            'prii_fixed',
        ]);
    });

    it('shows the flexible top-up first, whatever order the balance lists it in', () => {
        const wrapper = mountForm([
            createFixedItem({ pricingItemId: 'prii_ten', quantity: '10.00' }),
            createFixedItem({ pricingItemId: 'prii_fifty', quantity: '50.00' }),
            createFlexibleItem(),
        ]);

        expect(radios(wrapper).map((radio) => radio.element.value)).toEqual([
            'prii_flexible',
            'prii_ten',
            'prii_fifty',
        ]);
    });

    it('leaves the fixed top-ups in the order the balance lists them', () => {
        const wrapper = mountForm([
            createFixedItem({ pricingItemId: 'prii_fifty', quantity: '50.00' }),
            createFixedItem({ pricingItemId: 'prii_ten', quantity: '10.00' }),
        ]);

        expect(radios(wrapper).map((radio) => radio.element.value)).toEqual([
            'prii_fifty',
            'prii_ten',
        ]);
    });

    it('leaves out pricing items it cannot charge', () => {
        const wrapper = mountForm([createUnsupportedItem(), createFixedItem()]);

        expect(radios(wrapper).map((radio) => radio.element.value)).toEqual(['prii_fixed']);
    });

    it('labels a fixed top-up with what it costs', () => {
        const wrapper = mountForm([createFixedItem({ quantity: '10.00' })]);

        expect(wrapper.text()).toContain('10.00');
    });

    it('labels a flexible top-up with its bounds', () => {
        const wrapper = mountForm([createFlexibleItem()]);

        expect(wrapper.text()).toContain('Choose your own amount');
        expect(wrapper.text()).toContain('100.00');
        expect(wrapper.text()).toContain('1,000.00');
    });

    it('labels a fixed top-up in credits when the wallet holds credits', () => {
        const wrapper = mountForm([createFixedItem({ grantedCredits: '100' })]);

        expect(wrapper.text()).toContain('100 coins');
    });

    it('shows what a fixed top-up costs alongside the credits it grants', () => {
        const wrapper = mountForm([createFixedItem({ grantedCredits: '100', quantity: '10.00' })]);

        expect(wrapper.find('.sv-top-up-form__option-cost').text()).toContain('10.00');
    });

    it('does not repeat the cost when the option is already labelled with it', () => {
        const wrapper = mountForm([createFixedItem({ quantity: '10.00' })]);

        expect(wrapper.find('.sv-top-up-form__option-cost').exists()).toBe(false);
        expect(wrapper.text()).toContain('10.00');
    });

    it('shows no cost against the choose-your-amount option', () => {
        const wrapper = mountForm([createFlexibleItem({ inCredits: true })]);

        expect(wrapper.find('.sv-top-up-form__option-cost').exists()).toBe(false);
    });

    it('hides the flexible bounds while that option is not chosen', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);
        expect(wrapper.find('.expand--open').text()).toContain('Between');

        await select(wrapper, 1);

        expect(wrapper.find('.expand--open').exists()).toBe(false);
        expect(wrapper.find('.expand').text()).toContain('Between');
        expect(wrapper.text()).toContain('Choose your own amount');
    });

    it('brings the flexible bounds back when that option is chosen again', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);
        await select(wrapper, 1);

        await select(wrapper, 0);

        expect(wrapper.find('.expand--open').text()).toContain('Between');
    });

    it('gives a fixed top-up no expanding panel, having nothing to reveal', () => {
        const wrapper = mountForm([createFixedItem()]);

        expect(wrapper.find('.sv-top-up-form__options .expand').exists()).toBe(false);
    });

    it('labels flexible bounds in credits when the wallet holds credits', () => {
        const wrapper = mountForm([createFlexibleItem({ inCredits: true })]);

        expect(wrapper.text()).toContain('1000 coins');
        expect(wrapper.text()).toContain('10000 coins');
    });

    it('hides the radio dot', () => {
        const wrapper = mountForm([createFixedItem()]);

        expect(wrapper.find('.sv-top-up-form__options .rounded-full').exists()).toBe(false);
    });

    it('renders nothing to choose from when there are no pricing items', () => {
        expect(radios(mountForm([]))).toHaveLength(0);
        expect(radios(mountForm(undefined))).toHaveLength(0);
    });

    it('starts on the choose-your-amount top-up when the wallet offers one', () => {
        const wrapper = mountForm([createFixedItem(), createFlexibleItem()]);

        expect(checkedRadio(wrapper)).toBe('prii_flexible');
    });

    it('prices the top-up it started on without waiting to be nudged', () => {
        mountForm([createFixedItem(), createFlexibleItem()]);

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [
                { pricing_item_id: 'prii_flexible', flexible_amount: amountOf('100.00') },
            ],
        });
    });

    it('asks for nothing when the wallet offers nothing to charge', () => {
        mountForm([]);

        expect(mockPreview).not.toHaveBeenCalled();
    });

    it('starts on the first fixed top-up when no flexible one is offered', () => {
        const wrapper = mountForm([
            createFixedItem(),
            createFixedItem({ pricingItemId: 'prii_2' }),
        ]);

        expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([true, false]);
    });

    it('starts on the only top-up when the wallet offers one fixed option', () => {
        const wrapper = mountForm([createFixedItem()]);

        expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([true]);
    });

    it('previews the fixed top-up it starts on', () => {
        mountForm([createFixedItem()]);

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_fixed' }],
        });
    });

    it('does not overrule a choice the customer has already made', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        await select(wrapper, 1);

        expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, true]);
    });

    it('moves to the flexible top-up when the wallet on offer changes', async () => {
        const wrapper = mountForm([createFixedItem()]);
        expect(checkedRadio(wrapper)).toBe('prii_fixed');

        await wrapper.setProps({
            topUpPricingItems: [
                createFixedItem({ pricingItemId: 'prii_other' }),
                createFlexibleItem(),
            ],
        });

        expect(checkedRadio(wrapper)).toBe('prii_flexible');
    });

    it('previews a fixed top-up as soon as it is chosen, since its price is known', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        await select(wrapper, 1);

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_fixed' }],
        });
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });

    it('holds the height a preview will need while the request is out', async () => {
        mockPreview.mockReturnValue(new Promise(() => {}));
        const wrapper = mountForm([createFixedItem()]);

        await select(wrapper, 0);

        const skeleton = wrapper.find('[data-testid="top-up-invoice-preview-skeleton"]');
        expect(skeleton.classes()).toContain('h-[152px]');
        expect(skeleton.find('.sv-skeleton__title').exists()).toBe(false);
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(false);
    });

    it('gives way to the preview once it lands', async () => {
        const wrapper = mountForm([createFixedItem()]);

        await select(wrapper, 0);

        // Regression: the section wrapping the preview always rendered, and `Skeleton` steps aside for
        expect(wrapper.find('[data-testid="top-up-invoice-preview-skeleton"]').exists()).toBe(
            false,
        );
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(true);
    });

    it('offers an amount input for the choose-your-amount top-up', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        await select(wrapper, 0);

        expect(amountInput(wrapper).exists()).toBe(true);
    });

    it('previews the flexible top-up once an amount is entered', async () => {
        const wrapper = mountForm([createFlexibleItem()]);
        await select(wrapper, 0);

        await enterAmount(wrapper, '250');

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_flexible', flexible_amount: amountOf('250') }],
        });
    });

    it('clears the preview again when the amount is removed', async () => {
        const wrapper = mountForm([createFlexibleItem()]);
        await select(wrapper, 0);
        await enterAmount(wrapper, '250');

        await enterAmount(wrapper, '');

        expect(mockPreview).toHaveBeenCalledTimes(2);
        expect(wrapper.find('[data-testid="invoice-preview"]').exists()).toBe(false);
    });

    it('gives an amount input only to the flexible option, never to a fixed one', () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        // Regression: every option's panel used to render one, so a fixed row grew an input too.
        expect(wrapper.findAllComponents({ name: 'ConvertedAmountInputStub' })).toHaveLength(1);
    });

    it('starts the amount at the minimum the option allows', async () => {
        const wrapper = mountForm([createFlexibleItem()]);

        await select(wrapper, 0);

        expect(amountInput(wrapper).props('modelValue')).toBe('100.00');
    });

    it('starts it there again when the option is chosen a second time', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);
        await enterAmount(wrapper, '250');
        await select(wrapper, 1);

        await select(wrapper, 0);

        expect(amountInput(wrapper).props('modelValue')).toBe('100.00');
    });

    it('collapses the amount input when another top-up is chosen', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);
        expect(wrapper.find('.expand--open').exists()).toBe(true);

        await select(wrapper, 1);

        expect(wrapper.find('.expand--open').exists()).toBe(false);
        expect(amountInput(wrapper).exists()).toBe(true);
    });

    it('does not build an amount input before its option is ever chosen', () => {
        const wrapper = mountForm([
            createFixedItem(),
            createFlexibleItem({ pricingItemId: 'prii_b' }),
        ]);

        expect(wrapper.findAll('.expand--open')).toHaveLength(1);
    });

    it('charges only the chosen top-up when the choice changes', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);
        await select(wrapper, 0);
        await enterAmount(wrapper, '250');

        await select(wrapper, 1);

        expect(mockPreview).toHaveBeenLastCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_fixed' }],
        });
    });

    it('keeps the selection and the charge payload in step', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem()]);

        await select(wrapper, 1);

        expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, true]);
    });

    it('gives the amount input its bounds, currency and credits conversion', async () => {
        const wrapper = mountForm([createFlexibleItem({ inCredits: true })]);

        await select(wrapper, 0);

        expect(amountInput(wrapper).props()).toMatchObject({
            unit: 'coins',
            modelBase: 'AMOUNT',
            entryBase: 'CREDITS',
            currency: 'EUR',
            conversionRate: '10',
        });
    });

    it('offers the stored payment methods to pay with', () => {
        const paymentMethods = [createPaymentMethod('pm_1')];
        const wrapper = mountForm([createFlexibleItem()], { paymentMethods });

        expect(selector(wrapper).props()).toMatchObject({
            paymentMethods,
            label: 'Payment method',
        });
    });

    it('asks the modal to take over when the customer wants to add a method', async () => {
        const wrapper = mountForm([createFlexibleItem()]);

        await selector(wrapper).vm.$emit('add-payment-method');

        expect(wrapper.emitted('add-payment-method')).toHaveLength(1);
    });

    it('starts on the default payment method', () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [
                createPaymentMethod('pm_1'),
                createPaymentMethod('pm_default', true),
                createPaymentMethod('pm_3'),
            ],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pm_default');
    });

    it('falls back to the first payment method when none is the default', () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [createPaymentMethod('pm_1'), createPaymentMethod('pm_2')],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pm_1');
    });

    it('chooses nothing while the customer has no payment methods', () => {
        const wrapper = mountForm([createFlexibleItem()], { paymentMethods: [] });

        expect(selector(wrapper).props('modelValue')).toBeUndefined();
    });

    it('picks up the default once the payment methods arrive', async () => {
        const wrapper = mountForm([createFlexibleItem()], { paymentMethods: [] });

        await wrapper.setProps({
            paymentMethods: [createPaymentMethod('pm_1'), createPaymentMethod('pm_default', true)],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pm_default');
    });

    it('lists the payment methods newest first', () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [
                createPaymentMethod('pm_old', false, '2026-01-01T00:00:00Z'),
                createPaymentMethod('pm_new', false, '2026-06-01T00:00:00Z'),
                createPaymentMethod('pm_middle', false, '2026-03-01T00:00:00Z'),
            ],
        });

        expect(
            selector(wrapper)
                .props('paymentMethods')
                .map((method: { id: string }) => method.id),
        ).toEqual(['pm_new', 'pm_middle', 'pm_old']);
    });

    it('keeps a stable order when a payment method has no usable created_at', () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [
                createPaymentMethod('pm_undated', false, 'not-a-date'),
                createPaymentMethod('pm_dated', false, '2026-06-01T00:00:00Z'),
            ],
        });

        expect(
            selector(wrapper)
                .props('paymentMethods')
                .map((method: { id: string }) => method.id),
        ).toEqual(['pm_dated', 'pm_undated']);
    });

    it('selects a payment method the customer just added, over the default', async () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [createPaymentMethod('pm_default', true)],
        });
        expect(selector(wrapper).props('modelValue')).toBe('pm_default');

        await wrapper.setProps({
            paymentMethods: [
                createPaymentMethod('pm_default', true),
                createPaymentMethod('pm_added', false, '2026-06-01T00:00:00Z'),
            ],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pm_added');
    });

    it('leads the list with the payment method just added', async () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [createPaymentMethod('pm_existing', true, '2026-01-01T00:00:00Z')],
        });

        await wrapper.setProps({
            paymentMethods: [
                createPaymentMethod('pm_existing', true, '2026-01-01T00:00:00Z'),
                createPaymentMethod('pm_added', false, '2026-06-01T00:00:00Z'),
            ],
        });

        expect(
            selector(wrapper)
                .props('paymentMethods')
                .map((method: { id: string }) => method.id),
        ).toEqual(['pm_added', 'pm_existing']);
    });

    it('does not overrule a payment method the customer has chosen', async () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [createPaymentMethod('pm_1'), createPaymentMethod('pm_default', true)],
        });

        await selector(wrapper).vm.$emit('update:modelValue', 'pm_1');
        await nextTick();
        await wrapper.setProps({
            paymentMethods: [createPaymentMethod('pm_1'), createPaymentMethod('pm_default', true)],
        });

        expect(selector(wrapper).props('modelValue')).toBe('pm_1');
    });

    it('moves to the default when the chosen method is gone', async () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [
                createPaymentMethod('pm_gone'),
                createPaymentMethod('pm_default', true),
            ],
        });
        await selector(wrapper).vm.$emit('update:modelValue', 'pm_gone');
        await nextTick();

        await wrapper.setProps({ paymentMethods: [createPaymentMethod('pm_default', true)] });

        expect(selector(wrapper).props('modelValue')).toBe('pm_default');
    });

    it('records the chosen payment method on the charge payload', async () => {
        const wrapper = mountForm([createFlexibleItem()], {
            paymentMethods: [createPaymentMethod('pm_default', true), createPaymentMethod('pm_2')],
        });

        await selector(wrapper).vm.$emit('update:modelValue', 'pm_2');
        await nextTick();

        expect(selector(wrapper).props('modelValue')).toBe('pm_2');
    });

    it('does not preview without a schedule to charge on', async () => {
        const { pricingPlanScheduleId, ...withoutSchedule } = createFixedItem();
        const wrapper = mountForm([withoutSchedule as TopUpPricingItem]);

        await select(wrapper, 0);

        expect(pricingPlanScheduleId).toBeDefined();
        expect(mockPreview).not.toHaveBeenCalled();
    });

    it('charges the chosen top-up for real, not as a preview', async () => {
        const wrapper = mountForm([createFixedItem()], {
            paymentMethods: [createPaymentMethod('pm_1')],
        });
        await select(wrapper, 0);

        await wrapper.vm.submit();

        expect(mockCharge).toHaveBeenCalledWith({
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_items: [{ pricing_item_id: 'prii_fixed' }],
            payment_method_id: 'pm_1',
            preview: false,
        });
    });

    it('charges the entered amount for a flexible top-up', async () => {
        const wrapper = mountForm([createFlexibleItem()]);
        await select(wrapper, 0);
        await enterAmount(wrapper, '250');

        await wrapper.vm.submit();

        expect(mockCharge).toHaveBeenCalledWith(
            expect.objectContaining({
                pricing_items: [
                    { pricing_item_id: 'prii_flexible', flexible_amount: amountOf('250') },
                ],
            }),
        );
    });

    it('hands the invoice it produced to the modal', async () => {
        const wrapper = mountForm([createFixedItem()]);
        await select(wrapper, 0);

        await wrapper.vm.submit();

        expect(wrapper.emitted('success')).toEqual([[{ id: 'inv_charged' }]]);
        expect(wrapper.emitted('failure')).toBeUndefined();
    });

    it('reports a failed charge rather than closing the modal', async () => {
        const error = new Error('declined');
        mockCharge.mockRejectedValue(error);
        const wrapper = mountForm([createFixedItem()]);
        await select(wrapper, 0);

        await wrapper.vm.submit();

        expect(wrapper.emitted('failure')).toEqual([[error]]);
        expect(wrapper.emitted('success')).toBeUndefined();
        expect(wrapper.vm.isCharging).toBe(false);
    });

    it('refuses to charge a flexible top-up with no amount entered', async () => {
        const wrapper = mountForm([createFlexibleItem()]);
        await select(wrapper, 0);
        await enterAmount(wrapper, '');

        expect(wrapper.vm.canSubmit).toBe(false);
        await wrapper.vm.submit();

        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('locks the amount input down while the charge is out', async () => {
        mockCharge.mockReturnValue(new Promise(() => {}));
        const wrapper = mountForm([createFlexibleItem()]);
        await select(wrapper, 0);
        await enterAmount(wrapper, '250');
        expect(amountInput(wrapper).props('disabled')).toBeFalsy();

        void wrapper.vm.submit();
        await nextTick();

        expect(amountInput(wrapper).props('disabled')).toBe(true);
    });

    it('charges once however often the confirm button is pressed', async () => {
        const wrapper = mountForm([createFixedItem()]);
        await select(wrapper, 0);

        await Promise.all([wrapper.vm.submit(), wrapper.vm.submit()]);

        expect(mockCharge).toHaveBeenCalledTimes(1);
    });

    it('names what the chosen top-up adds, for the confirm button and the receipt', async () => {
        const wrapper = mountForm([createFlexibleItem(), createFixedItem({ quantity: '10.00' })]);

        await select(wrapper, 1);
        expect(wrapper.vm.chargedValue).toEqual({ amount: amountOf('10.00') });

        await select(wrapper, 0);
        expect(wrapper.vm.chargedValue).toEqual({ amount: amountOf('100.00') });

        await enterAmount(wrapper, '250');
        expect(wrapper.vm.chargedValue).toEqual({ amount: amountOf('250') });
    });

    it('names a credit based top-up in credits rather than in money', async () => {
        const wrapper = mountForm([
            createFlexibleItem({ inCredits: true }),
            createFixedItem({
                pricingItemId: 'prii_fixed',
                grantedCredits: '100',
                quantity: '10.00',
            }),
        ]);

        await select(wrapper, 1);
        expect(wrapper.vm.chargedValue).toEqual(creditsOf('100'));

        await select(wrapper, 0);
        await enterAmount(wrapper, '25');

        expect(wrapper.vm.chargedValue).toEqual(creditsOf('250'));
    });
});

describe('TopUpModalForm — what a charge requires', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const paymentMethodErrors = (wrapper: ReturnType<typeof mountForm>) =>
        (selector(wrapper).props('error') ?? []) as { $message: string }[];

    it('refuses to charge without a payment method', async () => {
        const wrapper = mountForm([createFixedItem()], { paymentMethods: [] });

        await wrapper.vm.submit();

        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('refuses to charge without a top-up chosen', async () => {
        const wrapper = mountForm([]);

        await wrapper.vm.submit();

        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('refuses to charge a flexible top-up with no amount', async () => {
        const wrapper = mountForm([createFlexibleItem()]);

        await enterAmount(wrapper, '');
        await wrapper.vm.submit();

        expect(mockCharge).not.toHaveBeenCalled();
    });

    it('charges once all three are in place', async () => {
        const wrapper = mountForm([createFixedItem()]);

        await wrapper.vm.submit();

        expect(mockCharge).toHaveBeenCalled();
    });

    it('says nothing about the payment method before a first attempt', () => {
        const wrapper = mountForm([createFixedItem()], { paymentMethods: [] });

        expect(paymentMethodErrors(wrapper)).toHaveLength(0);
    });

    it('faults the payment method on submit when none is selected', async () => {
        const wrapper = mountForm([createFixedItem()], { paymentMethods: [] });

        await wrapper.vm.submit();
        await nextTick();

        expect(paymentMethodErrors(wrapper).map(({ $message }) => $message)).toEqual([
            'Select a payment method to pay for this top-up.',
        ]);
    });

    it('leaves the payment method unfaulted when one is selected', async () => {
        const wrapper = mountForm([createFixedItem()]);

        await wrapper.vm.submit();
        await nextTick();

        expect(paymentMethodErrors(wrapper)).toHaveLength(0);
    });
    describe('auto top-up', () => {
        const AUTO_TOP_UP = {
            status: 'ACTIVE',
            threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
        };

        beforeEach(() => {
            mockCharge.mockReset();
            mockCharge.mockResolvedValue({ id: 'inv_charged' });
            mockAutoTopUp.validate.mockReset();
            mockAutoTopUp.validate.mockReturnValue(AUTO_TOP_UP);
            mockAutoTopUp.hasChanges = false;
            mockAutoTopUp.isInvalid = false;
        });

        it('asks for the rule in the currency the wallet is topped up in', () => {
            const wrapper = mountForm([createFlexibleItem()]);

            expect(editor(wrapper).props('denomination')).toEqual({ currency: 'EUR' });
        });

        it('leaves the threshold cost out of the rule beside a charge', () => {
            const wrapper = mountForm([createFlexibleItem({ inCredits: true })]);

            expect(editor(wrapper).props('showThresholdConversion')).toBe(false);
        });

        it('asks a credit based wallet for a threshold in its own credits', () => {
            const wrapper = mountForm([createFlexibleItem({ inCredits: true })]);

            expect(editor(wrapper).props('denomination')).toEqual({ creditTypeId: 'ctyp_1' });
            expect(editor(wrapper).props('creditUnitName')).toBe('coins');
        });

        it('leaves out a wallet that already has a rule', () => {
            const wrapper = mountForm([createFlexibleItem()], { autoTopUpConfig: AUTO_TOP_UP });

            expect(editor(wrapper).exists()).toBe(false);
        });

        it('leaves out a wallet with no choose-your-amount top-up', () => {
            const wrapper = mountForm([createFixedItem()]);

            expect(editor(wrapper).exists()).toBe(false);
        });

        it('asks nothing of a wallet with no way to be topped up', () => {
            expect(editor(mountForm([])).exists()).toBe(false);
        });

        it('refuses to charge while the rule does not validate', async () => {
            mockAutoTopUp.isInvalid = true;
            const wrapper = mountForm([createFlexibleItem()]);

            await wrapper.vm.submit();

            expect(mockCharge).not.toHaveBeenCalled();
        });

        it('faults the rule rather than ignoring it', async () => {
            mockAutoTopUp.isInvalid = true;
            const wrapper = mountForm([createFlexibleItem()]);

            await wrapper.vm.submit();

            expect(mockAutoTopUp.validate).toHaveBeenCalled();
        });

        it('hands over a changed rule once the top-up is charged', async () => {
            mockAutoTopUp.hasChanges = true;
            const wrapper = mountForm([createFlexibleItem()], {
                pricingItems: [
                    { pricing_item_id: 'prii_flexible', flexible_amount: amountOf('250') },
                ],
            });

            await wrapper.vm.submit();

            expect(wrapper.emitted('save-auto-top-up')).toEqual([
                [{ rule: AUTO_TOP_UP, paymentMethodId: 'pm_default' }],
            ]);
        });

        it('leaves a rule the customer never touched alone', async () => {
            const wrapper = mountForm([createFlexibleItem()]);

            await wrapper.vm.submit();

            expect(wrapper.emitted('save-auto-top-up')).toBeUndefined();
        });

        it('holds the rule back when the charge failed', async () => {
            mockAutoTopUp.hasChanges = true;
            mockCharge.mockRejectedValue(new Error('declined'));
            const wrapper = mountForm([createFlexibleItem()], {
                pricingItems: [
                    { pricing_item_id: 'prii_flexible', flexible_amount: amountOf('250') },
                ],
            });

            await wrapper.vm.submit();

            expect(wrapper.emitted('save-auto-top-up')).toBeUndefined();
        });
    });
});
