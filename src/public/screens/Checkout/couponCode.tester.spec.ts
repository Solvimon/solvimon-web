import { sanitizeCouponCode } from './couponCode';

describe('sanitizeCouponCode, adversarially', () => {
    it.each([
        ['a byte-order mark', 'SUMMER﻿25'],
        ['a no-break space', 'SUMMER 25'],
        ['a line separator', 'SUMMER 25'],
        ['a left-to-right mark', '‎SUMMER25'],
        ['a right-to-left mark', 'SUMMER25‏'],
        ['a right-to-left isolate', '⁧SUMMER25⁩'],
        ['a zero-width joiner', 'SUMMER‍25'],
        ['a soft hyphen', 'SUMMER­25'],
        ['a tag character', 'SUMMER\u{E0041}25'],
        ['a private-use character', 'SUMMER25'],
        ['an unassigned code point', 'SUMMER\u{0378}25'],
        ['a DEL', 'SUMMER\u007F25'],
        ['an escape sequence', 'SUMMER\u001B[31m25'],
        ['an encoded space left encoded', 'SUMMER%2025'.replace('%20', ' ')],
        ['129 astral characters, 258 code units', '😀'.repeat(129)],
    ])('drops %s', (_, value) => {
        expect(sanitizeCouponCode(value)).toBeUndefined();
    });

    it.each([
        ['padding of spaces, tabs and newlines', ' \t\nSUMMER25\r\n ', 'SUMMER25'],
        ['padding of no-break and ideographic spaces', ' 　SUMMER25 ', 'SUMMER25'],
        ['128 astral characters, 256 code units', '😀'.repeat(128), '😀'.repeat(128)],
        ['a combining accent', 'ÉTE', 'ÉTE'],
        // No whitespace or invisible characters: kept, and safe only because nothing renders it
        // as HTML. It reaches the API as the code and the promotion code field as text.
        ['markup without spaces', '<script>alert(1)</script>', '<script>alert(1)</script>'],
        ['a quote and an ampersand', `"'&amp;`, `"'&amp;`],
    ])('keeps %s', (_, value, expected) => {
        expect(sanitizeCouponCode(value)).toBe(expected);
    });
});
