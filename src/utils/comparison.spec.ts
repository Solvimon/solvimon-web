import { isEmpty } from './comparison';

describe('isEmpty', () => {
    it.each([null, undefined, '', [], {}, 0, false])('returns true for %j', (value) => {
        expect(isEmpty(value)).toBe(true);
    });

    it('returns true for an empty Map', () => {
        expect(isEmpty(new Map())).toBe(true);
    });

    it('returns true for an empty Set', () => {
        expect(isEmpty(new Set())).toBe(true);
    });

    it.each(['hello', [1], { a: 1 }])('returns false for %j', (value) => {
        expect(isEmpty(value)).toBe(false);
    });

    it('returns false for a non-empty Map', () => {
        expect(isEmpty(new Map([[1, 1]]))).toBe(false);
    });

    it('returns false for a non-empty Set', () => {
        expect(isEmpty(new Set([1]))).toBe(false);
    });
});
