import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import AutoTopUpConfig from './AutoTopUpConfig.vue';
import type { AutoTopUpRule } from './AutoTopUpConfig.types';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Section: defineComponent({
            name: 'SectionStub',
            props: {
                contentBackground: { type: String, default: 'gray' },
                noSpacing: { type: Boolean, default: false },
                noBorder: { type: Boolean, default: false },
            },
            template: '<div class="section"><slot /></div>',
        }),
        Input: defineComponent({
            name: 'InputStub',
            props: ['modelValue', 'label', 'error', 'disabled', 'required', 'name', 'type', 'step'],
            emits: ['update:modelValue'],
            template:
                '<div class="input" :data-label="label"><slot name="label-suffix" /><slot name="suffix" /><slot name="helper" /></div>',
        }),
    });
});

const SAVED_RULE: AutoTopUpRule = {
    status: 'ACTIVE',
    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
    topup_amount: { quantity: '10.00', currency: 'EUR' },
};

const mountEditor = (props: Record<string, unknown> = {}) =>
    mount(AutoTopUpConfig, {
        props: { denomination: { currency: 'EUR' }, chargeCurrency: 'EUR', ...props },
        attachTo: document.body,
    });

const isSwitchedOn = (wrapper: ReturnType<typeof mountEditor>) =>
    (wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked;

const amountInputs = (wrapper: ReturnType<typeof mountEditor>) =>
    wrapper.findAllComponents({ name: 'InputStub' });

const errorMessages = (wrapper: ReturnType<typeof mountEditor>, index: number) =>
    (amountInputs(wrapper)[index].props('error') as { $message: string }[]).map(
        ({ $message }) => $message,
    );

const conversionAfter = (wrapper: ReturnType<typeof mountEditor>, field: 'threshold' | 'amount') =>
    wrapper.find(`[data-testid="auto-top-up-${field}-conversion"]`);

const unitAfter = (wrapper: ReturnType<typeof mountEditor>, field: 'threshold' | 'amount') =>
    wrapper.find(`[data-testid="auto-top-up-${field}-unit"]`).text();

const setAmount = async (
    wrapper: ReturnType<typeof mountEditor>,
    index: number,
    quantity: string,
) => {
    amountInputs(wrapper)[index].vm.$emit('update:modelValue', quantity);
    await nextTick();
};

describe('AutoTopUpConfig', () => {
    it('opens switched off, with nothing to fill in yet', () => {
        const wrapper = mountEditor();

        expect(isSwitchedOn(wrapper)).toBe(false);
        expect(amountInputs(wrapper)).toHaveLength(0);
    });

    it('asks for the threshold and the top-up amount once the rule is switched on', async () => {
        const wrapper = mountEditor();

        await wrapper.find('input[type="checkbox"]').setValue(true);

        expect(amountInputs(wrapper)).toHaveLength(2);
    });

    it('asks for the top-up in credits for a credit wallet and still charges money', async () => {
        const wrapper = mountEditor({
            denomination: { creditTypeId: 'ctyp_1' },
            creditUnitName: 'coins',
            conversionRate: '10',
        });

        await wrapper.find('input[type="checkbox"]').setValue(true);
        await setAmount(wrapper, 0, '1000');
        await setAmount(wrapper, 1, '250');
        wrapper.vm.submit();

        expect(unitAfter(wrapper, 'threshold')).toBe('coins');
        expect(unitAfter(wrapper, 'amount')).toBe('coins');
        expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
            status: 'ACTIVE',
            threshold: { credits: { quantity: '1000', credit_type_id: 'ctyp_1' } },
            topup_amount: { quantity: '25.00', currency: 'EUR' },
        });
    });

    describe('with the switch left out', () => {
        it('shows no switch and asks straight away', () => {
            const wrapper = mountEditor({ alwaysEnabled: true });

            expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
            expect(amountInputs(wrapper)).toHaveLength(2);
        });

        it('saves the rule as active', async () => {
            const wrapper = mountEditor({ alwaysEnabled: true });

            await setAmount(wrapper, 0, '5.00');
            await setAmount(wrapper, 1, '10.00');
            wrapper.vm.submit();

            expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ status: 'ACTIVE' });
        });

        it('still refuses a rule with nothing filled in', async () => {
            const wrapper = mountEditor({ alwaysEnabled: true });

            wrapper.vm.submit();
            await nextTick();

            expect(wrapper.emitted('save')).toBeUndefined();
        });
    });

    it('opens on the saved rule', () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        expect(isSwitchedOn(wrapper)).toBe(true);
        expect(amountInputs(wrapper)[0].props('modelValue')).toBe('5.00');
    });

    it('puts the wallet currency after an empty threshold', async () => {
        const wrapper = mountEditor({ denomination: { currency: 'USD' } });

        await wrapper.find('input[type="checkbox"]').setValue(true);

        expect(amountInputs(wrapper)[0].props('modelValue')).toBe('');
        expect(unitAfter(wrapper, 'threshold')).toBe('USD');
    });

    it('puts the credit unit after the threshold for a credit wallet', async () => {
        const wrapper = mountEditor({
            denomination: { creditTypeId: 'ctyp_1' },
            creditUnitName: 'coins',
        });

        await wrapper.find('input[type="checkbox"]').setValue(true);

        expect(unitAfter(wrapper, 'threshold')).toBe('coins');
    });

    it('states what a credits threshold and a credits top-up come to in money', async () => {
        const wrapper = mountEditor({
            denomination: { creditTypeId: 'ctyp_1' },
            creditUnitName: 'coins',
            conversionRate: '10',
        });

        await wrapper.find('input[type="checkbox"]').setValue(true);
        await setAmount(wrapper, 0, '1000');
        await setAmount(wrapper, 1, '250');

        expect(conversionAfter(wrapper, 'threshold').text()).toBe(
            'Will cost €100.00 excluding taxes',
        );
        expect(conversionAfter(wrapper, 'amount').text()).toBe('Will cost €25.00 excluding taxes');
    });

    it('leaves the threshold cost out when the caller asks it to', async () => {
        const wrapper = mountEditor({
            denomination: { creditTypeId: 'ctyp_1' },
            creditUnitName: 'coins',
            conversionRate: '10',
            showThresholdConversion: false,
        });

        await wrapper.find('input[type="checkbox"]').setValue(true);
        await setAmount(wrapper, 0, '1000');
        await setAmount(wrapper, 1, '250');

        expect(conversionAfter(wrapper, 'threshold').exists()).toBe(false);
        expect(conversionAfter(wrapper, 'amount').text()).toBe('Will cost €25.00 excluding taxes');
    });

    it('converts nothing for a wallet counted in money', async () => {
        const wrapper = mountEditor();

        await wrapper.find('input[type="checkbox"]').setValue(true);
        await setAmount(wrapper, 0, '5.00');

        expect(conversionAfter(wrapper, 'threshold').exists()).toBe(false);
        expect(conversionAfter(wrapper, 'amount').exists()).toBe(false);
    });

    describe('the range the top-up pricing allows', () => {
        const TOP_UP_BOUNDS = {
            minimum: { quantity: '5.00', currency: 'EUR' },
            maximum: { quantity: '500.00', currency: 'EUR' },
        };

        it('states the range beside the top-up amount and nothing beside the threshold', async () => {
            const wrapper = mountEditor({ topUpBounds: TOP_UP_BOUNDS });

            await wrapper.find('input[type="checkbox"]').setValue(true);

            expect(wrapper.find('[data-testid="auto-top-up-amount-bounds"]').text()).toBe(
                'Between 5.00 and 500.00 EUR',
            );
            expect(wrapper.find('[data-testid="auto-top-up-threshold-bounds"]').exists()).toBe(
                false,
            );
        });

        it('refuses a top-up below the smallest charge the pricing sells', async () => {
            const wrapper = mountEditor({ topUpBounds: TOP_UP_BOUNDS });

            await wrapper.find('input[type="checkbox"]').setValue(true);
            await setAmount(wrapper, 0, '5.00');
            await setAmount(wrapper, 1, '2.50');
            wrapper.vm.submit();
            await nextTick();

            expect(wrapper.emitted('save')).toBeUndefined();
            expect(errorMessages(wrapper, 1)).toContain('Top up with at least 5.00 EUR.');
        });

        it('refuses a top-up above the largest charge the pricing sells', async () => {
            const wrapper = mountEditor({ topUpBounds: TOP_UP_BOUNDS });

            await wrapper.find('input[type="checkbox"]').setValue(true);
            await setAmount(wrapper, 0, '5.00');
            await setAmount(wrapper, 1, '750.00');
            wrapper.vm.submit();
            await nextTick();

            expect(wrapper.emitted('save')).toBeUndefined();
            expect(errorMessages(wrapper, 1)).toContain('Top up with at most 500.00 EUR.');
        });

        it('states the range and the refusal in credits for a credit wallet', async () => {
            const wrapper = mountEditor({
                denomination: { creditTypeId: 'ctyp_1' },
                creditUnitName: 'coins',
                conversionRate: '10',
                topUpBounds: TOP_UP_BOUNDS,
            });

            await wrapper.find('input[type="checkbox"]').setValue(true);
            await setAmount(wrapper, 0, '1000');
            await setAmount(wrapper, 1, '25');
            wrapper.vm.submit();
            await nextTick();

            expect(wrapper.find('[data-testid="auto-top-up-amount-bounds"]').text()).toBe(
                'Between 50 and 5000 coins',
            );
            expect(wrapper.emitted('save')).toBeUndefined();
            expect(errorMessages(wrapper, 1)).toContain('Top up with at least 50 coins.');
        });

        it('saves a top-up that falls inside the range', async () => {
            const wrapper = mountEditor({ topUpBounds: TOP_UP_BOUNDS });

            await wrapper.find('input[type="checkbox"]').setValue(true);
            await setAmount(wrapper, 0, '5.00');
            await setAmount(wrapper, 1, '10.00');
            wrapper.vm.submit();

            expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
                topup_amount: { quantity: '10.00', currency: 'EUR' },
            });
        });

        it('leaves an unbounded top-up to the rules that always apply', async () => {
            const wrapper = mountEditor();

            await wrapper.find('input[type="checkbox"]').setValue(true);
            await setAmount(wrapper, 0, '5.00');
            await setAmount(wrapper, 1, '750.00');
            wrapper.vm.submit();

            expect(wrapper.emitted('save')).toHaveLength(1);
        });
    });

    it('hands the edited rule over on submit', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        await setAmount(wrapper, 0, '25.00');
        wrapper.vm.submit();

        expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
            status: 'ACTIVE',
            threshold: { amount: { quantity: '25.00', currency: 'EUR' } },
            topup_amount: { quantity: '10.00', currency: 'EUR' },
        });
    });

    it('refuses a rule with no top-up amount', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        await setAmount(wrapper, 1, '');
        wrapper.vm.submit();
        await nextTick();

        expect(wrapper.emitted('save')).toBeUndefined();
        expect(amountInputs(wrapper)[1].props('error')).not.toHaveLength(0);
    });

    it('opens the amount on the minimum a top-up may be charged for', async () => {
        const wrapper = mountEditor({
            topUpBounds: { minimum: { quantity: '10.00', currency: 'EUR' } },
        });

        await wrapper.find('input[type="checkbox"]').setValue(true);

        expect(amountInputs(wrapper)[1].props('modelValue')).toBe('10.00');
    });

    it('opens the amount on the saved rule rather than the minimum', async () => {
        const wrapper = mountEditor({
            config: SAVED_RULE,
            topUpBounds: { minimum: { quantity: '5.00', currency: 'EUR' } },
        });
        await nextTick();

        expect(amountInputs(wrapper)[1].props('modelValue')).toBe('10.00');
    });

    describe('panel', () => {
        it('is drawn in a grey panel when contained', () => {
            const section = mountEditor({ config: SAVED_RULE, contained: true }).findComponent({
                name: 'SectionStub',
            });

            expect(section.props('contentBackground')).toBe('gray');
            expect(section.props('noSpacing')).toBe(false);
        });

        it('is drawn plain and unpadded by default', () => {
            const section = mountEditor({ config: SAVED_RULE }).findComponent({
                name: 'SectionStub',
            });

            expect(section.props('contentBackground')).toBe('none');
            expect(section.props('noSpacing')).toBe(true);
            expect(section.props('noBorder')).toBe(true);
        });
    });

    it('refuses a top-up amount of nothing', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        await setAmount(wrapper, 1, '0');
        wrapper.vm.submit();
        await nextTick();

        expect(wrapper.emitted('save')).toBeUndefined();
        expect(amountInputs(wrapper)[1].props('error')).not.toHaveLength(0);
    });

    it('saves a credit wallet threshold as credits rather than money', async () => {
        const wrapper = mountEditor({
            config: {
                status: 'ACTIVE',
                threshold: { credits: { quantity: '500', credit_type_id: 'ctyp_1' } },
                topup_amount: { quantity: '10.00', currency: 'EUR' },
            },
            denomination: { creditTypeId: 'ctyp_1' },
            creditUnitName: 'coins',
        });

        await setAmount(wrapper, 0, '750');
        wrapper.vm.submit();

        expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
            status: 'ACTIVE',
            threshold: { credits: { quantity: '750', credit_type_id: 'ctyp_1' } },
            topup_amount: { quantity: '10.00', currency: 'EUR' },
        });
    });

    it('refuses to save a rule that is switched on with nothing filled in', async () => {
        const wrapper = mountEditor();

        await wrapper.find('input[type="checkbox"]').setValue(true);
        wrapper.vm.submit();
        await nextTick();

        expect(wrapper.emitted('save')).toBeUndefined();
        expect(amountInputs(wrapper)[0].props('error')).not.toHaveLength(0);
    });

    it('saves a rule that is switched off without asking for a threshold', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        await wrapper.find('input[type="checkbox"]').setValue(false);
        wrapper.vm.submit();

        expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ status: 'INACTIVE' });
    });

    it('refuses a negative threshold', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        await setAmount(wrapper, 0, '-5.00');
        wrapper.vm.submit();
        await nextTick();

        expect(wrapper.emitted('save')).toBeUndefined();
        expect(amountInputs(wrapper)[0].props('error')).not.toHaveLength(0);
    });

    it('reports whether the rule differs from the saved one', async () => {
        const wrapper = mountEditor({ config: SAVED_RULE });

        expect(wrapper.vm.hasChanges).toBe(false);

        await setAmount(wrapper, 0, '7.50');

        expect(wrapper.vm.hasChanges).toBe(true);
    });
});
