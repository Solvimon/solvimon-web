import { toRestorableForm } from './savedFormState';

describe('toRestorableForm', () => {
    it('keeps every field that has the shape the form gives it', () => {
        const saved = {
            email: 'customer@example.com',
            country: 'NL',
            type: 'ORGANIZATION',
            companyLegalName: 'Acme',
            firstName: 'Ada',
            companyVatNumber: 'NL123456789B01',
            promotionCode: 'SPRING',
            seatsValues: [{ pricing_item_config_id: 'pic_1', number: '3' }],
            unitsValues: [{ pricing_item_config_id: 'pic_2', number: '0' }],
            enabledPricingIds: ['pri_1'],
            shippingAddressLine1: 'Main street 1',
            shippingPostalCode: '1000AA',
            shippingCity: 'Amsterdam',
            shippingCountry: 'DE',
            shippingPhoneNumber: '+31 6 12345678',
            billingAddressSameAsShipping: false,
        };

        expect(toRestorableForm(saved)).toEqual(saved);
    });

    it.each([
        ['an email that is not one', { email: 'not an email' }],
        ['an email that is not text', { email: 42 }],
        ['an unknown country', { country: 'XX' }],
        ['an unknown customer type', { type: 'ROBOT' }],
        ['a name that is not text', { firstName: { toString: 'Ada' } }],
        ['a promotion code that is not text', { promotionCode: ['SPRING'] }],
        ['seats without a config id', { seatsValues: [{ number: '3' }] }],
        ['seats without a number', { seatsValues: [{ pricing_item_config_id: 'pic_1' }] }],
        [
            'seats where one of several is not a count',
            {
                seatsValues: [
                    { pricing_item_config_id: 'pic_1', number: '2' },
                    { pricing_item_config_id: 'pic_2', number: '1.5' },
                ],
            },
        ],
        ['seats that are not a list', { seatsValues: { pic_1: '3' } }],
        ['pricing ids that are not text', { enabledPricingIds: ['pri_1', 2] }],
        ['an unknown shipping country', { shippingCountry: 'XX' }],
        ['a same-address choice that is not a boolean', { billingAddressSameAsShipping: 'yes' }],
    ])('drops %s', (_, saved) => {
        expect(toRestorableForm(saved)).toEqual({});
    });

    it('drops a field it does not know', () => {
        expect(toRestorableForm({ firstName: 'Ada', isAdmin: true })).toEqual({ firstName: 'Ada' });
    });

    it('keeps only the parts of a seat value the form sets', () => {
        expect(
            toRestorableForm({
                seatsValues: [{ pricing_item_config_id: 'pic_1', number: '3', extra: 'x' }],
            }),
        ).toEqual({ seatsValues: [{ pricing_item_config_id: 'pic_1', number: '3' }] });
    });

    it.each([null, 'form', 42, []])('restores nothing from %j', (saved) => {
        expect(toRestorableForm(saved)).toEqual({});
    });
});

describe('toRestorableForm on hostile or unusual input', () => {
    it('takes nothing from prototype keys and pollutes no prototype', () => {
        const saved: unknown = JSON.parse(
            '{"__proto__":{"email":"evil@example.com","polluted":true},' +
                '"constructor":{"prototype":{"polluted":true}},"firstName":"Ada"}',
        );

        const form = toRestorableForm(saved);

        expect(form).toEqual({ firstName: 'Ada' });
        expect(Object.getPrototypeOf(form)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('handles a very long list quickly', () => {
        const seatsValues = Array.from({ length: 200_000 }, (_, index) => ({
            pricing_item_config_id: `pic_${index}`,
            number: '1',
        }));
        const started = performance.now();
        const form = toRestorableForm({ seatsValues });
        expect(performance.now() - started).toBeLessThan(1000);
        // Not capped: whatever fits in storage is restored and later priced.
        expect(form.seatsValues).toHaveLength(200_000);
    });

    it.each([
        ['a number given as a number', 5],
        ['a number that is not numeric', 'abc'],
        ['a negative number', '-3'],
    ])('drops seats with %s', (_, number) => {
        const form = toRestorableForm({
            seatsValues: [{ pricing_item_config_id: 'pic_1', number }],
        });
        expect(form.seatsValues).toBeUndefined();
    });

    it('keeps an email with unicode only if the form would accept it', () => {
        const form = toRestorableForm({ email: 'jürgen@bücher.de' });
        expect(form.email === undefined || form.email === 'jürgen@bücher.de').toBe(true);
    });

    it('drops a country in lowercase', () => {
        expect(toRestorableForm({ country: 'nl' })).toEqual({});
    });
});
