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
