import { isEqual, isEmpty } from './comparison';

describe('isEqual', () => {
    describe('primitives', () => {
        it.each([
            [0, 0],
            [1, 1],
            [false, false],
            [true, true],
            ['', ''],
            ['hello', 'hello'],
            [null, null],
            [undefined, undefined],
        ])('returns true for equal value %j', (a, b) => {
            expect(isEqual(a, b)).toBe(true);
        });

        it.each([
            [0, false],
            [0, null],
            [0, undefined],
            [false, null],
            [false, undefined],
            [null, undefined],
            ['', false],
            ['', 0],
        ])('returns false for %j vs %j', (a, b) => {
            expect(isEqual(a, b)).toBe(false);
        });
    });

    describe('objects', () => {
        it('returns true for equal flat objects', () => {
            expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        });

        it('returns true for equal nested objects', () => {
            expect(isEqual({ a: { b: { c: 3 } } }, { a: { b: { c: 3 } } })).toBe(true);
        });

        it('returns false when a property value differs', () => {
            expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
        });

        it('returns false when one object has an extra property', () => {
            expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        });

        it('returns false when a property is undefined vs absent', () => {
            expect(isEqual({ a: undefined }, {})).toBe(false);
        });

        it('returns true for two objects with the same undefined property', () => {
            expect(isEqual({ a: undefined }, { a: undefined })).toBe(true);
        });
    });

    describe('arrays', () => {
        it('returns true for equal arrays', () => {
            expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        });

        it('returns false for arrays of different length', () => {
            expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
        });

        it('returns false for arrays with different values', () => {
            expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false);
        });

        it('returns false for undefined vs null in an array', () => {
            expect(isEqual([undefined], [null])).toBe(false);
        });

        it('returns true for two arrays containing undefined', () => {
            expect(isEqual([undefined], [undefined])).toBe(true);
        });
    });
});

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
