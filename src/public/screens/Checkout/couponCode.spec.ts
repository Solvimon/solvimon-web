import { sanitizeCouponCode } from './couponCode';

describe('sanitizeCouponCode', () => {
    it.each(['SUMMER25', 'summer-25_off', 'ÉTÉ2026', '50%OFF', 'a'.repeat(256)])(
        'keeps the code %s',
        (code) => {
            expect(sanitizeCouponCode(code)).toBe(code);
        },
    );

    it('trims surrounding whitespace', () => {
        expect(sanitizeCouponCode('  SUMMER25\n')).toBe('SUMMER25');
    });

    it.each([
        ['nothing', null],
        ['undefined', undefined],
        ['an empty string', ''],
        ['only whitespace', '   '],
        ['inner whitespace', 'SUMMER 25'],
        ['a tab', 'SUMMER\t25'],
        ['a zero-width space', 'SUMMER​25'],
        ['a right-to-left override', 'SUMMER‮52'],
        ['a control character', 'SUMMER\u000025'],
        ['a lone surrogate', 'SUMMER\uD80025'],
        ['a markup payload with spaces', '<img src=x onerror=alert(1)>'],
        ['a code over the limit', 'a'.repeat(257)],
        ['a very long value', 'x'.repeat(100_000)],
    ])('drops %s', (_, value) => {
        expect(sanitizeCouponCode(value)).toBeUndefined();
    });
});
