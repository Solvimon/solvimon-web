import type { PaymentMethod } from '@solvimon/solvimon-types';
import { computed, nextTick, ref } from 'vue';
import { useDefaultPaymentMethod } from './useDefaultPaymentMethod';

const createPaymentMethod = (
    id: string,
    { isDefault = false, createdAt = '2026-01-01T00:00:00Z' } = {},
) => ({ id, is_default: isDefault, created_at: createdAt }) as PaymentMethod;

const setup = ({
    paymentMethods = [] as PaymentMethod[],
    preferredPaymentMethodId = undefined as string | undefined,
} = {}) => {
    const methods = ref<PaymentMethod[] | undefined>(paymentMethods);
    const preferred = ref(preferredPaymentMethodId);
    const selectedPaymentMethodId = ref<string | undefined>();

    return {
        methods,
        preferred,
        selectedPaymentMethodId,
        ...useDefaultPaymentMethod({
            paymentMethods: methods,
            selectedPaymentMethodId,
            preferredPaymentMethodId: computed(() => preferred.value),
        }),
    };
};

describe('useDefaultPaymentMethod', () => {
    it('starts on the customer default', () => {
        const { selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_1'),
                createPaymentMethod('pm_default', { isDefault: true }),
            ],
        });

        expect(selectedPaymentMethodId.value).toBe('pm_default');
    });

    it('falls back to the newest method the customer has', () => {
        const { selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_old', { createdAt: '2026-01-01T00:00:00Z' }),
                createPaymentMethod('pm_new', { createdAt: '2026-06-01T00:00:00Z' }),
            ],
        });

        expect(selectedPaymentMethodId.value).toBe('pm_new');
    });

    it('lists them newest first, so a method just added leads', () => {
        const { sortedPaymentMethods } = setup({
            paymentMethods: [
                createPaymentMethod('pm_old', { createdAt: '2026-01-01T00:00:00Z' }),
                createPaymentMethod('pm_new', { createdAt: '2026-06-01T00:00:00Z' }),
            ],
        });

        expect(sortedPaymentMethods.value.map(({ id }) => id)).toEqual(['pm_new', 'pm_old']);
    });

    // Adding a method was a deliberate act, so it wins over the default the customer set long ago.
    it('follows a method the customer has just added', async () => {
        const { methods, selectedPaymentMethodId } = setup({
            paymentMethods: [createPaymentMethod('pm_default', { isDefault: true })],
        });

        methods.value = [
            createPaymentMethod('pm_default', { isDefault: true }),
            createPaymentMethod('pm_added'),
        ];
        await nextTick();

        expect(selectedPaymentMethodId.value).toBe('pm_added');
    });

    // Arriving from nothing is the list loading rather than the customer adding anything.
    it('takes the default when the list arrives from empty', async () => {
        const { methods, selectedPaymentMethodId } = setup();

        methods.value = [
            createPaymentMethod('pm_1'),
            createPaymentMethod('pm_default', { isDefault: true }),
        ];
        await nextTick();

        expect(selectedPaymentMethodId.value).toBe('pm_default');
    });

    it('leaves a choice the customer has made alone', async () => {
        const { methods, selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_1'),
                createPaymentMethod('pm_default', { isDefault: true }),
            ],
        });

        selectedPaymentMethodId.value = 'pm_1';
        await nextTick();

        // The list is answered again, later: it cannot overrule what they picked in the meantime.
        methods.value = [
            createPaymentMethod('pm_1'),
            createPaymentMethod('pm_default', { isDefault: true }),
        ];
        await nextTick();

        expect(selectedPaymentMethodId.value).toBe('pm_1');
    });

    it('moves off a method that is gone', async () => {
        const { methods, selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_gone'),
                createPaymentMethod('pm_default', { isDefault: true }),
            ],
        });

        selectedPaymentMethodId.value = 'pm_gone';
        await nextTick();

        methods.value = [createPaymentMethod('pm_default', { isDefault: true })];
        await nextTick();

        expect(selectedPaymentMethodId.value).toBe('pm_default');
    });

    // What an existing rule already charges is what editing it should open on.
    it('prefers the method the caller says is already being charged', () => {
        const { selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_saved'),
                createPaymentMethod('pm_default', { isDefault: true }),
            ],
            preferredPaymentMethodId: 'pm_saved',
        });

        expect(selectedPaymentMethodId.value).toBe('pm_saved');
    });

    it('ignores a preferred method the customer no longer has', () => {
        const { selectedPaymentMethodId } = setup({
            paymentMethods: [createPaymentMethod('pm_default', { isDefault: true })],
            preferredPaymentMethodId: 'pm_deleted',
        });

        expect(selectedPaymentMethodId.value).toBe('pm_default');
    });

    it('picks again once the caller clears the selection, such as on reopening', async () => {
        const { selectedPaymentMethodId } = setup({
            paymentMethods: [
                createPaymentMethod('pm_1'),
                createPaymentMethod('pm_default', { isDefault: true }),
            ],
        });

        selectedPaymentMethodId.value = 'pm_1';
        await nextTick();
        selectedPaymentMethodId.value = undefined;
        await nextTick();

        expect(selectedPaymentMethodId.value).toBe('pm_default');
    });

    it('chooses nothing while the customer has no methods', () => {
        expect(setup().selectedPaymentMethodId.value).toBeUndefined();
    });
});
