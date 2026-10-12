import type { Amount } from '@solvimon/solvimon-types';
import { getCurrencyDecimals, toMinorUnitAmount } from './amount';

describe('toMinorUnitAmount', () => {
    it('should transform USD amount correctly', () => {
        const amount: Amount = { quantity: '10.50', currency: 'USD' };
        const result = toMinorUnitAmount(amount);
        expect(result.currency).toBe('USD');
        expect(result.value).toBe(1050);
    });

    it('should transform EUR amount correctly', () => {
        const amount: Amount = { quantity: '25.99', currency: 'EUR' };
        const result = toMinorUnitAmount(amount);
        expect(result.currency).toBe('EUR');
        expect(result.value).toBe(2599);
    });

    it('should handle amounts with more decimal places than the currency supports', () => {
        const amount: Amount = { quantity: '10.1234', currency: 'USD' };
        const result = toMinorUnitAmount(amount);
        expect(result.currency).toBe('USD');
        expect(result.value).toBe(1012);
    });

    it('should handle zero amount', () => {
        const amount: Amount = { quantity: '0', currency: 'USD' };
        const result = toMinorUnitAmount(amount);
        expect(result.currency).toBe('USD');
        expect(result.value).toBe(0);
    });

    it('should handle large amounts', () => {
        const amount: Amount = { quantity: '999999.99', currency: 'USD' };
        const result = toMinorUnitAmount(amount);
        expect(result.currency).toBe('USD');
        expect(result.value).toBe(99999999);
    });
});

describe('getCurrencyDecimals', () => {
    it.each([
        ['EUR', 2],
        ['JPY', 0],
        ['KWD', 3],
        ['BHD', 3],
    ])('counts %s in %i decimals', (currency, decimals) => {
        expect(getCurrencyDecimals(currency)).toBe(decimals);
    });

    it.each([undefined, '', 'coins'])('falls back to cents for %p', (currency) => {
        expect(getCurrencyDecimals(currency)).toBe(2);
    });
});
