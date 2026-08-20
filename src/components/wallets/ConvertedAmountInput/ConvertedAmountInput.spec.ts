import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ConvertedAmountInput from './ConvertedAmountInput.vue';
import type { ConvertedAmountInputProps } from './ConvertedAmountInput.types';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountInput = (props: Partial<ConvertedAmountInputProps> = {}, modelValue = '') =>
    mount(ConvertedAmountInput, {
        props: {
            label: 'When your balance falls below',
            name: 'threshold',
            unit: 'coins',
            modelBase: 'CREDITS',
            currency: 'EUR',
            conversionRate: '10',
            showConversionHint: true,
            modelValue,
            ...props,
        },
        attachTo: document.body,
    });

const unit = (wrapper: ReturnType<typeof mountInput>) =>
    wrapper.find('[data-testid="threshold-unit"]').text();

const inputValue = (wrapper: ReturnType<typeof mountInput>) =>
    (wrapper.find('input').element as HTMLInputElement).value;

const conversion = (wrapper: ReturnType<typeof mountInput>) =>
    wrapper.find('[data-testid="threshold-conversion"]');

const bounds = (wrapper: ReturnType<typeof mountInput>) =>
    wrapper.find('[data-testid="threshold-bounds"]');

const MINIMUM = { quantity: '5.00', currency: 'EUR' };
const MAXIMUM = { quantity: '500.00', currency: 'EUR' };

describe('ConvertedAmountInput', () => {
    it('counts the field in the unit it was given', () => {
        expect(unit(mountInput())).toBe('coins');
    });

    it('says what a number of credits costs', () => {
        expect(conversion(mountInput({}, '1000')).text()).toBe('Will cost €100.00 excluding taxes');
    });

    it('says what an amount of money buys', () => {
        const wrapper = mountInput(
            { unit: 'EUR', modelBase: 'AMOUNT', creditUnitName: 'coins', currency: undefined },
            '25',
        );

        expect(conversion(wrapper).text()).toBe('Buys about 250 coins');
    });

    it('names the credits generically where the wallet does not name them', () => {
        const wrapper = mountInput({ unit: 'EUR', modelBase: 'AMOUNT', currency: undefined }, '25');

        expect(conversion(wrapper).text()).toBe('Buys about 250 credits');
    });

    it('converts as the customer types', async () => {
        const wrapper = mountInput({}, '1000');

        await wrapper.setProps({ modelValue: '250' });

        expect(conversion(wrapper).text()).toBe('Will cost €25.00 excluding taxes');
    });

    it('shows no conversion unless it is asked for', () => {
        expect(conversion(mountInput({ showConversionHint: undefined }, '1000')).exists()).toBe(
            false,
        );
    });

    it('has nothing to convert while the field is empty', () => {
        expect(conversion(mountInput()).exists()).toBe(false);
    });

    it('shows no conversion for a wallet with no rate, such as one held in money', () => {
        const wrapper = mountInput(
            { unit: 'EUR', modelBase: 'AMOUNT', conversionRate: undefined },
            '25',
        );

        expect(conversion(wrapper).exists()).toBe(false);
    });

    it('rounds the money a rate does not divide evenly into to the cent', () => {
        expect(conversion(mountInput({ conversionRate: '3' }, '1000')).text()).toBe(
            'Will cost €333.33 excluding taxes',
        );
    });

    it('reports what the customer typed, so the form holds the quantity rather than the unit', async () => {
        const wrapper = mountInput();

        await wrapper.find('input').setValue('750');

        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['750']);
    });

    describe('whatever the input hands back', () => {
        const reportedByInput = async (value: unknown) => {
            const wrapper = mountInput({}, '1000');

            wrapper.findComponent({ name: 'Input' }).vm.$emit('update:modelValue', value);
            await nextTick();

            return wrapper.emitted('update:modelValue')?.at(-1)?.[0];
        };

        it('keeps text as it was typed', async () => {
            expect(await reportedByInput('25.00')).toBe('25.00');
        });

        it('reads a number as its digits', async () => {
            expect(await reportedByInput(30)).toBe('30');
        });

        it.each([[null], [undefined], [['a', 'b']]])('empties the field for %s', async (value) => {
            expect(await reportedByInput(value)).toBe('');
        });
    });

    describe('the range the pricing allows', () => {
        it('states both ends beside the label of a money field', () => {
            const wrapper = mountInput({
                unit: 'EUR',
                modelBase: 'AMOUNT',
                bounds: { minimum: MINIMUM, maximum: MAXIMUM },
            });

            expect(bounds(wrapper).text()).toBe('Between 5.00 and 500.00 EUR');
        });

        it('states them in credits beside the label of a credits field', () => {
            const wrapper = mountInput({ bounds: { minimum: MINIMUM, maximum: MAXIMUM } });

            expect(bounds(wrapper).text()).toBe('Between 50 and 5000 coins');
        });

        it('states an open-ended range from the end the pricing does configure', () => {
            const minimumOnly = mountInput({
                unit: 'EUR',
                modelBase: 'AMOUNT',
                bounds: { minimum: MINIMUM },
            });
            const maximumOnly = mountInput({
                unit: 'EUR',
                modelBase: 'AMOUNT',
                bounds: { maximum: MAXIMUM },
            });

            expect(minimumOnly.text()).toContain('At least 5.00 EUR');
            expect(maximumOnly.text()).toContain('Up to 500.00 EUR');
        });

        it('says nothing where the pricing bounds neither end', () => {
            expect(bounds(mountInput({ bounds: {} })).exists()).toBe(false);
            expect(bounds(mountInput()).exists()).toBe(false);
        });

        it('says nothing for a credits field with no rate to restate them by', () => {
            const wrapper = mountInput({
                conversionRate: undefined,
                bounds: { minimum: MINIMUM, maximum: MAXIMUM },
            });

            expect(bounds(wrapper).exists()).toBe(false);
        });
    });

    describe('typing credits into a field that hands back money', () => {
        const mountCreditsEntry = (props = {}, modelValue = '') =>
            mountInput(
                { unit: 'coins', modelBase: 'AMOUNT', entryBase: 'CREDITS', ...props },
                modelValue,
            );

        it('counts the field in credits', () => {
            expect(unit(mountCreditsEntry())).toBe('coins');
        });

        it('hands back the money that buys the credits typed', async () => {
            const wrapper = mountCreditsEntry();

            await wrapper.find('input').setValue('250');

            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['25.00']);
        });

        it('rounds what it hands back to the cent, since money is what gets charged', async () => {
            const wrapper = mountCreditsEntry({ conversionRate: '3' });

            await wrapper.find('input').setValue('1000');

            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['333.33']);
        });

        it('shows a money model as the credits it buys', () => {
            expect(inputValue(mountCreditsEntry({}, '25.00'))).toBe('250');
        });

        it('restates the model when the caller reseeds it, such as from a saved rule', async () => {
            const wrapper = mountCreditsEntry({}, '25.00');

            await wrapper.setProps({ modelValue: '10.00' });

            expect(inputValue(wrapper)).toBe('100');
        });

        it('leaves what is typed alone while it still comes to what the model holds', async () => {
            const wrapper = mountCreditsEntry();

            await wrapper.find('input').setValue('250');
            await wrapper.setProps({ modelValue: '25.00' });

            expect(inputValue(wrapper)).toBe('250');
        });

        it('says what the credits typed will cost', () => {
            expect(conversion(mountCreditsEntry({}, '25.00')).text()).toBe(
                'Will cost €25.00 excluding taxes',
            );
        });

        it('states the range it may be charged for in credits too', () => {
            const wrapper = mountCreditsEntry({ bounds: { minimum: MINIMUM, maximum: MAXIMUM } });

            expect(bounds(wrapper).text()).toBe('Between 50 and 5000 coins');
        });

        it('falls back to asking for money where no rate relates the two', async () => {
            const wrapper = mountCreditsEntry({ conversionRate: undefined });

            await wrapper.find('input').setValue('25.00');

            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['25.00']);
        });
    });

    it('shows the error instead of the conversion, since the field cannot be trusted yet', () => {
        const wrapper = mountInput({ error: 'Enter the balance to top up at.' }, '1000');

        expect(conversion(wrapper).exists()).toBe(false);
        expect(wrapper.text()).toContain('Enter the balance to top up at.');
    });
});
