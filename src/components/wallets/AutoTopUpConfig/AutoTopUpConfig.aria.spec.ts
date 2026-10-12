import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AutoTopUpConfig from './AutoTopUpConfig.vue';
import type { AutoTopUpRule } from './AutoTopUpConfig.types';

/** The rule editor with solvimon-ui's real Input, so `aria-invalid` lands on the actual field. */

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const BELOW_MINIMUM: AutoTopUpRule = {
    status: 'ACTIVE',
    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
    topup_amount: { quantity: '2.50', currency: 'EUR' },
};

const mountEditor = (props: Record<string, unknown> = {}) =>
    mount(AutoTopUpConfig, {
        props: {
            denomination: { currency: 'EUR' },
            chargeCurrency: 'EUR',
            alwaysEnabled: true,
            topUpBounds: { minimum: { quantity: '25.00', currency: 'EUR' } },
            ...props,
        },
        attachTo: document.body,
    });

const invalidity = (wrapper: ReturnType<typeof mountEditor>) =>
    ['auto-top-up-threshold', 'auto-top-up-amount'].map((name) =>
        wrapper.find(`input[name="${name}"]`).attributes('aria-invalid'),
    );

afterEach(() => {
    document.body.innerHTML = '';
});

describe('AutoTopUpConfig — aria-invalid', () => {
    it('marks nothing on an empty rule before the customer does anything', () => {
        expect(invalidity(mountEditor())).toEqual([undefined, undefined]);
    });

    it('marks nothing on a saved rule that no longer fits the bounds, before any interaction', () => {
        expect(invalidity(mountEditor({ config: BELOW_MINIMUM }))).toEqual([undefined, undefined]);
    });

    // The amount is seeded with the pricing's minimum, so only the threshold starts empty.
    it('marks the empty threshold once the rule is checked', async () => {
        const wrapper = mountEditor();

        wrapper.vm.validate();
        await nextTick();

        expect(invalidity(wrapper)).toEqual(['true', undefined]);
    });

    it('marks only the field that is wrong once it is typed into', async () => {
        const wrapper = mountEditor({ config: BELOW_MINIMUM });

        await wrapper.find('input[name="auto-top-up-amount"]').setValue('3');

        expect(invalidity(wrapper)).toEqual([undefined, 'true']);
    });

    // Observation: `useValidation` runs with `$autoDirty`, so a saved rule that arrives (or is
    // refetched) after the editor is built reseeds the model and flags it without the customer
    // touching anything.
    it('flags a saved rule that arrives late, without interaction', async () => {
        const wrapper = mountEditor();

        await wrapper.setProps({ config: BELOW_MINIMUM });
        await nextTick();

        expect(invalidity(wrapper)[1]).toBe('true');
    });
});
