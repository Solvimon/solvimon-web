import type { WalletBalanceValue } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { TopUpModalStep } from './TopUpModal.types';
import { useTopUpModalLabels } from './useTopUpModalLabels';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

/** Credits of a wallet whose credit type is named coin/coins. */
const creditsOf = (quantity: string) =>
    ({
        credits: {
            quantity,
            credit_type_id: 'ctyp_1',
            credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
        },
    }) as unknown as WalletBalanceValue;

const moneyOf = (quantity: string): WalletBalanceValue => ({
    amount: { quantity, currency: 'EUR' },
});

const createLabels = ({
    step = 'TOP_UP',
    topUpValue,
}: { step?: TopUpModalStep; topUpValue?: WalletBalanceValue } = {}) =>
    useTopUpModalLabels({
        step: ref<TopUpModalStep>(step),
        currentBalance: ref('500 coins'),
        topUpValue: ref(topUpValue),
    });

describe('useTopUpModalLabels', () => {
    it('names a credit based top-up in credits on the confirm button', () => {
        const { confirmButtonText } = createLabels({ topUpValue: creditsOf('1000') });

        // Unseparated: the intl mock's formatNumber returns the raw quantity.
        expect(confirmButtonText.value).toBe('Top up balance with 1000 coins');
    });

    it('names a money based top-up as money on the confirm button', () => {
        const { confirmButtonText } = createLabels({ topUpValue: moneyOf('10.00') });

        expect(confirmButtonText.value).toBe('Top up balance with €10.00');
    });

    it('asks for an amount before naming one', () => {
        const { confirmButtonText } = createLabels();

        expect(confirmButtonText.value).toBe('Top up balance');
    });

    it('follows the top-up as the customer changes it', () => {
        const topUpValue = ref<WalletBalanceValue | undefined>();
        const { confirmButtonText } = useTopUpModalLabels({
            step: ref<TopUpModalStep>('TOP_UP'),
            currentBalance: ref('500 coins'),
            topUpValue,
        });
        expect(confirmButtonText.value).toBe('Top up balance');

        topUpValue.value = creditsOf('2500');

        expect(confirmButtonText.value).toBe('Top up balance with 2500 coins');
    });

    it('leaves the top-up out of the label on the other steps', () => {
        const topUpValue = creditsOf('1000');

        expect(
            createLabels({ step: 'ADD_PAYMENT_METHOD', topUpValue }).confirmButtonText.value,
        ).toBe('Save payment method');
        expect(createLabels({ step: 'SUCCESS', topUpValue }).confirmButtonText.value).toBe('Done');
    });

    it('names each step in its title and subtitle', () => {
        expect(createLabels().title.value).toBe('Top up balance');
        expect(createLabels().subTitle.value).toBe('Your current balance is 500 coins.');

        expect(createLabels({ step: 'ADD_PAYMENT_METHOD' }).title.value).toBe('Add payment method');
        expect(createLabels({ step: 'SUCCESS' }).title.value).toBe('Top-up complete');
    });

    it('offers a way back rather than a way out while adding a payment method', () => {
        expect(createLabels({ step: 'ADD_PAYMENT_METHOD' }).cancelButtonText.value).toBe('Back');
        expect(createLabels().cancelButtonText.value).toBe('Cancel');
    });
});
