import { ref } from 'vue';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import { usePaymentMethodSelectorOptions } from './usePaymentMethodSelectorOptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        reference: 'ref_1',
        is_default: false,
        status: 'ACTIVE',
        type: 'CARD',
        card: { brand: 'VISA', last_four_digits: '4242' },
        ...overrides,
    }) as unknown as PaymentMethod;

const optionsFor = (...paymentMethods: PaymentMethod[]) =>
    usePaymentMethodSelectorOptions(ref(paymentMethods)).options.value;

const firstLabel = (...paymentMethods: PaymentMethod[]) => optionsFor(...paymentMethods)[0].label;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePaymentMethodSelectorOptions', () => {
    it('maps each payment method onto an option keyed by its id', () => {
        const options = optionsFor(
            createPaymentMethod({ id: 'pm_1' }),
            createPaymentMethod({ id: 'pm_2' }),
        );

        expect(options.map((option) => option.value)).toEqual(['pm_1', 'pm_2']);
    });

    it('preserves the order the payment methods came in', () => {
        const options = optionsFor(
            createPaymentMethod({ id: 'pm_b' }),
            createPaymentMethod({ id: 'pm_a' }),
        );

        expect(options.map((option) => option.value)).toEqual(['pm_b', 'pm_a']);
    });

    it('names a card by its humanised brand and last four digits', () => {
        expect(
            firstLabel(
                createPaymentMethod({
                    type: 'CARD',
                    card: { brand: 'AMERICAN_EXPRESS', last_four_digits: '0005' },
                } as Partial<PaymentMethod>),
            ),
        ).toBe('American express 0005');
    });

    it('names direct debit by its variant and owner', () => {
        expect(
            firstLabel(
                createPaymentMethod({
                    type: 'DIRECT_DEBIT',
                    card: undefined,
                    direct_debit: { variant: 'SEPA_DIRECT_DEBIT', owner_name: 'Ada Lovelace' },
                } as unknown as Partial<PaymentMethod>),
            ),
        ).toBe('Sepa direct debit Ada Lovelace');
    });

    it('names a digital wallet by its variant', () => {
        expect(
            firstLabel(
                createPaymentMethod({
                    type: 'DIGITAL_WALLET',
                    card: undefined,
                    digital_wallet: { variant: 'PAYPAL' },
                } as unknown as Partial<PaymentMethod>),
            ),
        ).toBe('Paypal');
    });

    it('falls back to the type so a sparse method is never left unnamed', () => {
        expect(
            firstLabel(
                createPaymentMethod({
                    type: 'BUY_NOW_PAY_LATER',
                    card: undefined,
                    buy_now_pay_later: undefined,
                } as unknown as Partial<PaymentMethod>),
            ),
        ).toBe('Buy now pay later');
    });

    it('looks payment methods up by id for the prefix slot', () => {
        const first = createPaymentMethod({ id: 'pm_1' });
        const second = createPaymentMethod({ id: 'pm_2' });

        const { paymentMethodsById } = usePaymentMethodSelectorOptions(ref([first, second]));

        expect(paymentMethodsById.value).toEqual({ pm_1: first, pm_2: second });
    });

    it('tracks changes to the payment methods', () => {
        const paymentMethods = ref([createPaymentMethod({ id: 'pm_1' })]);
        const { options, paymentMethodsById } = usePaymentMethodSelectorOptions(paymentMethods);

        expect(options.value).toHaveLength(1);

        paymentMethods.value = [
            createPaymentMethod({ id: 'pm_1' }),
            createPaymentMethod({ id: 'pm_2' }),
        ];

        expect(options.value.map((option) => option.value)).toEqual(['pm_1', 'pm_2']);
        expect(Object.keys(paymentMethodsById.value)).toEqual(['pm_1', 'pm_2']);
    });
});
