import {
    getThresholdUnit,
    isAtLeastMinimum,
    isWithinMaximum,
    normalizeAutoTopUpRule,
    toAutoTopUpRule,
    toFormState,
    toThreshold,
} from './AutoTopUpConfig.lib';
import type { AutoTopUpDenomination, AutoTopUpRule } from './AutoTopUpConfig.types';

const MONEY: AutoTopUpDenomination = { currency: 'EUR' };
const CREDITS: AutoTopUpDenomination = { creditTypeId: 'ctyp_1' };

const SAVED_RULE: AutoTopUpRule = {
    status: 'ACTIVE',
    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
    topup_amount: { quantity: '10.00', currency: 'EUR' },
};

const SAVED_CREDIT_RULE: AutoTopUpRule = {
    status: 'ACTIVE',
    threshold: { credits: { quantity: '500', credit_type_id: 'ctyp_1' } },
    topup_amount: { quantity: '10.00', currency: 'EUR' },
};

describe('getThresholdUnit', () => {
    it('is the currency for a wallet counted in money', () => {
        expect(getThresholdUnit(MONEY)).toBe('EUR');
    });

    it('is what the credits are called for a wallet counted in credits', () => {
        expect(getThresholdUnit(CREDITS, 'coins')).toBe('coins');
    });

    // Better a stable identifier in front of the field than nothing at all.
    it('falls back to the credit type when the credits have no name', () => {
        expect(getThresholdUnit(CREDITS)).toBe('ctyp_1');
    });
});

describe('toFormState', () => {
    it('opens off with empty amounts when nothing is configured', () => {
        expect(toFormState(undefined, { denomination: MONEY, chargeCurrency: 'EUR' })).toEqual({
            enabled: false,
            threshold: { quantity: null, currency: 'EUR' },
            topUpAmount: { quantity: null, currency: 'EUR' },
        });
    });

    // The credits are what the charge grants; what is paid is money either way.
    it('asks a credit wallet for its top-up amount in money', () => {
        const state = toFormState(SAVED_CREDIT_RULE, {
            denomination: CREDITS,
            chargeCurrency: 'EUR',
            creditUnitName: 'coins',
        });

        expect(state.threshold?.currency).toBe('coins');
        expect(state.topUpAmount).toEqual({ quantity: '10.00', currency: 'EUR' });
    });

    // The smallest the pricing allows is the one figure certain to be accepted.
    it('opens a wallet with no rule on the smallest top-up it allows', () => {
        const state = toFormState(undefined, {
            denomination: MONEY,
            chargeCurrency: 'EUR',
            minimumTopUp: '10.00',
        });

        expect(state.topUpAmount).toEqual({ quantity: '10.00', currency: 'EUR' });
    });

    it('opens on the saved amount rather than the minimum once there is a rule', () => {
        const state = toFormState(SAVED_RULE, {
            denomination: MONEY,
            chargeCurrency: 'EUR',
            minimumTopUp: '10.00',
        });

        expect(state.topUpAmount?.quantity).toBe(SAVED_RULE.topup_amount?.quantity);
    });

    it('opens on for a rule that is active', () => {
        expect(
            toFormState(SAVED_RULE, { denomination: MONEY, chargeCurrency: 'EUR' }).enabled,
        ).toBe(true);
    });

    it('opens off for a rule that was switched off, keeping its threshold', () => {
        const state = toFormState(
            { ...SAVED_RULE, status: 'INACTIVE' },
            { denomination: MONEY, chargeCurrency: 'EUR' },
        );

        expect(state.enabled).toBe(false);
        expect(state.threshold?.quantity).toBe('5.00');
    });

    // The field is the same either way, so a credits threshold reads out of the same place.
    it('reads a credits threshold into the same field', () => {
        expect(
            toFormState(SAVED_CREDIT_RULE, {
                denomination: CREDITS,
                chargeCurrency: 'EUR',
                creditUnitName: 'coins',
            }).threshold,
        ).toEqual({
            quantity: '500',
            currency: 'coins',
        });
    });
});

describe('toThreshold', () => {
    it('writes money for a wallet counted in money', () => {
        const state = toFormState(SAVED_RULE, { denomination: MONEY, chargeCurrency: 'EUR' });

        expect(toThreshold(state, MONEY)).toEqual({
            amount: { quantity: '5.00', currency: 'EUR' },
        });
    });

    // What the customer typed is credits, so it must not go out as an amount of currency.
    it('writes credits for a wallet counted in credits', () => {
        const state = toFormState(SAVED_CREDIT_RULE, {
            denomination: CREDITS,
            chargeCurrency: 'EUR',
            creditUnitName: 'coins',
        });

        expect(toThreshold(state, CREDITS)).toEqual({
            credits: { quantity: '500', credit_type_id: 'ctyp_1' },
        });
    });

    // A zero threshold would read as "top up when the balance hits nothing".
    it('is empty when the field was left empty', () => {
        expect(
            toThreshold(
                toFormState(undefined, { denomination: MONEY, chargeCurrency: 'EUR' }),
                MONEY,
            ),
        ).toEqual({});
    });
});

describe('toAutoTopUpRule', () => {
    it('is ACTIVE while the switch is on', () => {
        expect(
            toAutoTopUpRule(
                toFormState(SAVED_RULE, { denomination: MONEY, chargeCurrency: 'EUR' }),
                { denomination: MONEY, chargeCurrency: 'EUR' },
            ).status,
        ).toBe('ACTIVE');
    });

    it('is INACTIVE while the switch is off', () => {
        expect(
            toAutoTopUpRule(
                toFormState(undefined, { denomination: MONEY, chargeCurrency: 'EUR' }),
                { denomination: MONEY, chargeCurrency: 'EUR' },
            ).status,
        ).toBe('INACTIVE');
    });

    it('keeps a rule that came back from the API equal to itself', () => {
        expect(
            toAutoTopUpRule(
                toFormState(SAVED_RULE, { denomination: MONEY, chargeCurrency: 'EUR' }),
                { denomination: MONEY, chargeCurrency: 'EUR' },
            ),
        ).toEqual(
            normalizeAutoTopUpRule(SAVED_RULE, { denomination: MONEY, chargeCurrency: 'EUR' }),
        );
    });
});

describe('isAtLeastMinimum', () => {
    it('clears a top-up that meets the smallest charge the pricing sells', () => {
        expect(isAtLeastMinimum(5, { quantity: '5.00', currency: 'EUR' })).toBe(true);
        expect(isAtLeastMinimum(10, { quantity: '5.00', currency: 'EUR' })).toBe(true);
    });

    it('refuses a top-up below it', () => {
        expect(isAtLeastMinimum(2.5, { quantity: '5.00', currency: 'EUR' })).toBe(false);
    });

    // Emptiness is the required rule's to report, and an unbounded pricing has nothing to clear.
    it('passes an empty field and an unbounded pricing', () => {
        expect(isAtLeastMinimum(null, { quantity: '5.00', currency: 'EUR' })).toBe(true);
        expect(isAtLeastMinimum(2.5, undefined)).toBe(true);
        expect(isAtLeastMinimum(2.5, { quantity: '', currency: 'EUR' })).toBe(true);
    });
});

describe('isWithinMaximum', () => {
    it('clears a top-up up to the largest charge the pricing sells', () => {
        expect(isWithinMaximum(500, { quantity: '500.00', currency: 'EUR' })).toBe(true);
        expect(isWithinMaximum(100, { quantity: '500.00', currency: 'EUR' })).toBe(true);
    });

    it('refuses a top-up above it', () => {
        expect(isWithinMaximum(750, { quantity: '500.00', currency: 'EUR' })).toBe(false);
    });

    it('passes an empty field and an unbounded pricing', () => {
        expect(isWithinMaximum(null, { quantity: '500.00', currency: 'EUR' })).toBe(true);
        expect(isWithinMaximum(750, undefined)).toBe(true);
    });
});
