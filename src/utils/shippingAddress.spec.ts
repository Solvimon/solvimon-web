import { toAddress } from './shippingAddress';

describe('toAddress', () => {
    it('leaves out the lines the API sends as null', () => {
        expect(
            toAddress({
                line1: 'Damrak 1',
                line2: null,
                city: 'Amsterdam',
                postal_code: '1012 LG',
                state: null,
                country: 'NL',
            }),
        ).toEqual({
            line1: 'Damrak 1',
            line2: undefined,
            city: 'Amsterdam',
            postal_code: '1012 LG',
            state: undefined,
            country: 'NL',
        });
    });
});
