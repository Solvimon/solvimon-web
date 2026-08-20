import { ref } from 'vue';
import { useAddPaymentMethodStep } from './useAddPaymentMethodStep';

type Step = 'TOP_UP' | 'ADD_PAYMENT_METHOD';

const createStep = (current: Step = 'TOP_UP') => {
    const step = ref<Step>(current);

    return {
        step,
        ...useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'TOP_UP' }),
    };
};

describe('useAddPaymentMethodStep', () => {
    it('is inactive while the host is somewhere else', () => {
        expect(createStep().isActive.value).toBe(false);
    });

    it('is active once the host has stepped over to it', () => {
        const { open, isActive } = createStep();

        open();

        expect(isActive.value).toBe(true);
    });

    it('steps the host back where it came from', () => {
        const { step, open, leave } = createStep();
        open();

        leave();

        expect(step.value).toBe('TOP_UP');
    });

    it('reports nothing pending until the pane says so', () => {
        expect(createStep().isSaving.value).toBe(false);
    });

    it('reports the pane saving', () => {
        const { paneRef, isSaving } = createStep();

        paneRef.value = { isSaving: true } as never;

        expect(isSaving.value).toBe(true);
    });

    it('submits through the pane', () => {
        const submit = vi.fn();
        const step = createStep();
        step.paneRef.value = { submit } as never;

        step.submit();

        expect(submit).toHaveBeenCalledTimes(1);
    });

    it('submits nothing when there is no pane yet', () => {
        expect(() => createStep().submit()).not.toThrow();
    });
});
