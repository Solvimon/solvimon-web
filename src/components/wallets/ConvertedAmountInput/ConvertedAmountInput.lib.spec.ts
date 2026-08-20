import {
    toBaseQuantity,
    toConvertedQuantity,
    toMoneyQuantity,
    toNumber,
} from './ConvertedAmountInput.lib';

describe('toNumber', () => {
    it('reads a quantity as a number', () => {
        expect(toNumber('12.50')).toBe(12.5);
    });

    it.each([undefined, null, '', 'abc'])('has no number to read in %p', (quantity) => {
        expect(toNumber(quantity)).toBeUndefined();
    });

    it('reads a zero rather than mistaking it for an empty field', () => {
        expect(toNumber('0')).toBe(0);
    });
});

describe('toConvertedQuantity', () => {
    it('states credits as the money they cost', () => {
        expect(toConvertedQuantity('1000', 'CREDITS', '10')).toBe(100);
    });

    it('states money as the credits it buys', () => {
        expect(toConvertedQuantity('25', 'AMOUNT', '10')).toBe(250);
    });

    it('converts a zero, since a threshold of nothing is a threshold', () => {
        expect(toConvertedQuantity('0', 'CREDITS', '10')).toBe(0);
    });

    it.each([undefined, null, ''])(
        'has nothing to convert while the field holds %p',
        (quantity) => {
            expect(toConvertedQuantity(quantity, 'CREDITS', '10')).toBeUndefined();
        },
    );

    it('has nothing to convert without a rate to convert by', () => {
        expect(toConvertedQuantity('1000', 'CREDITS', undefined)).toBeUndefined();
    });

    it.each(['0', '-2', 'free'])('refuses the unusable rate %p', (rate) => {
        expect(toConvertedQuantity('1000', 'CREDITS', rate)).toBeUndefined();
    });
});

describe('toBaseQuantity', () => {
    it('leaves a money bound alone for a field counted in money', () => {
        expect(toBaseQuantity('5.00', 'AMOUNT', '10')).toBe(5);
    });

    it('states a money bound in credits for a field counted in credits', () => {
        expect(toBaseQuantity('5.00', 'CREDITS', '10')).toBe(50);
    });

    it('reads a money bound even where no rate was configured', () => {
        expect(toBaseQuantity('5.00', 'AMOUNT', undefined)).toBe(5);
    });

    it('cannot state a bound in credits without a rate to state it by', () => {
        expect(toBaseQuantity('5.00', 'CREDITS', undefined)).toBeUndefined();
    });

    it('has no bound to state where the pricing configured none', () => {
        expect(toBaseQuantity(undefined, 'AMOUNT', '10')).toBeUndefined();
    });
});

describe('toMoneyQuantity', () => {
    it('rounds a rate that does not divide evenly to the cent', () => {
        expect(toMoneyQuantity(1000 / 3)).toBe('333.33');
    });

    it('spells out the cents of a round figure', () => {
        expect(toMoneyQuantity(100)).toBe('100.00');
    });
});
