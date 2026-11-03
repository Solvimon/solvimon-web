import type { PaymentMethod } from '@solvimon/solvimon-types';
import {
    getChargeableStoredPaymentMethods,
    getPreselectedPaymentMethodId,
    getStoredPaymentMethodLabel,
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
    ])('leaves out a method %s', (_, paymentMethod) => {
        expect(getChargeableStoredPaymentMethods([paymentMethod], options)).toEqual([]);
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
