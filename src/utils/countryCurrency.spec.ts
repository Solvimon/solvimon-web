import { getCurrencyForCountry, getPricingCurrencyForCountry } from './countryCurrency';

describe('countryCurrency', () => {
    it('returns ISO currency for a country', () => {
        expect(getCurrencyForCountry('NL')).toBe('EUR');
        expect(getCurrencyForCountry('US')).toBe('USD');
        expect(getCurrencyForCountry('GB')).toBe('GBP');
    });

    it('prefers supported country currency, otherwise defaults or fallback', () => {
        const pricingCurrencySettings = {
            default_pricing_currency: 'BRL',
            pricing_currencies: ['BRL', 'AUD'],
        };

        expect(
            getPricingCurrencyForCountry({
                country: 'AU',
                pricingCurrencySettings,
                fallbackCurrency: 'USD',
            }),
        ).toBe('AUD');

        expect(
            getPricingCurrencyForCountry({
                country: 'NL',
                pricingCurrencySettings,
                fallbackCurrency: 'USD',
            }),
        ).toBe('BRL');

        expect(
            getPricingCurrencyForCountry({
                country: undefined,
                pricingCurrencySettings: undefined,
                fallbackCurrency: 'USD',
            }),
        ).toBe('USD');
    });
});
