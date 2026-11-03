import type { PaymentMethod } from '@solvimon/solvimon-types';
import {
    getChargeableStoredPaymentMethods,
    getPreselectedPaymentMethodId,
    getStoredPaymentMethodLabel,
    isExpiredCard,
} from './PayInvoice.lib';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

const card = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pmet_1',
        type: 'CARD',
        status: 'ACTIVE',
        is_default: false,
        integration_id: 'int_adyen',
        card: { brand: 'VISA', last_four_digits: '4242' },
        ...overrides,
    }) as PaymentMethod;

const options = [
    createPaymentMethodOptionEntry({ paymentAcceptorId: 'paya_adyen', integrationId: 'int_adyen' }),
];

describe('getChargeableStoredPaymentMethods', () => {
    it("pairs a stored method with the invoice's acceptor on the gateway that holds it", () => {
        expect(getChargeableStoredPaymentMethods([card()], options)).toEqual([
            { paymentMethod: card(), paymentAcceptorId: 'paya_adyen' },
        ]);
    });

    it.each([
        ['stored with another gateway', card({ integration_id: 'int_stripe' })],
        ['stored without a gateway', card({ integration_id: undefined })],
        ['not active', card({ status: 'INACTIVE' })],
        [
            'that has expired',
            card({
                card: {
                    brand: 'VISA',
                    last_four_digits: '0019',
                    expiry_date: { expiry_month: 1, expiry_year: 2024 },
                },
            } as Partial<PaymentMethod>),
        ],
    ])('leaves out a method %s', (_, paymentMethod) => {
        expect(getChargeableStoredPaymentMethods([paymentMethod], options)).toEqual([]);
    });
});

describe('isExpiredCard', () => {
    const expiring = (expiry_month: number, expiry_year: number) =>
        card({
            card: {
                brand: 'VISA',
                last_four_digits: '4242',
                expiry_date: { expiry_month, expiry_year },
            },
        } as Partial<PaymentMethod>);

    it.each([
        ['through the last day of its expiry month', '2026-03-31T23:59:59Z', false],
        ['from the first day of the month after', '2026-04-01T00:00:00Z', true],
    ])('keeps a card valid %s', (_, now, expired) => {
        expect(isExpiredCard(expiring(3, 2026), new Date(now))).toBe(expired);
    });

    it('rolls an expiry in December over to the next year', () => {
        expect(isExpiredCard(expiring(12, 2026), new Date('2026-12-31T12:00:00Z'))).toBe(false);
        expect(isExpiredCard(expiring(12, 2026), new Date('2027-01-01T00:00:00Z'))).toBe(true);
    });

    it('never calls a card without an expiry date, or another type, expired', () => {
        expect(isExpiredCard(card())).toBe(false);
        expect(
            isExpiredCard({ id: 'pmet_dd', type: 'DIRECT_DEBIT' } as unknown as PaymentMethod),
        ).toBe(false);
    });
});

describe('getPreselectedPaymentMethodId', () => {
    it.each([
        ['the only method', [card()], 'pmet_1'],
        ['the default among several', [card(), card({ id: 'pmet_2', is_default: true })], 'pmet_2'],
        ['the first among several without a default', [card(), card({ id: 'pmet_2' })], 'pmet_1'],
        ['nothing without methods', [], undefined],
    ])('selects %s', (_, paymentMethods, expected) => {
        expect(getPreselectedPaymentMethodId(paymentMethods)).toBe(expected);
    });
});

describe('getStoredPaymentMethodLabel', () => {
    it('names a card by its brand and last digits', () => {
        expect(getStoredPaymentMethodLabel(card())).toBe('Visa •••• 4242');
    });

    it('names any other method as the method list does', () => {
        expect(
            getStoredPaymentMethodLabel({
                id: 'pmet_3',
                type: 'DIRECT_DEBIT',
                direct_debit: { variant: 'SEPA', owner_name: 'J. Jansen' },
            } as unknown as PaymentMethod),
        ).toBe('Sepa J. Jansen');
    });
});
