import { describe, it, expect } from 'vitest';
import { isReleaseType, parseReleaseType } from './bump-version.mjs';

describe('isReleaseType', () => {
    it('returns true for valid release types', () => {
        expect(isReleaseType('patch')).toBe(true);
        expect(isReleaseType('minor')).toBe(true);
        expect(isReleaseType('major')).toBe(true);
    });

    it('returns false for anything else', () => {
        expect(isReleaseType('1')).toBe(false);
        expect(isReleaseType('hotfix')).toBe(false);
        expect(isReleaseType('')).toBe(false);
        expect(isReleaseType(undefined)).toBe(false);
    });
});

describe('parseReleaseType', () => {
    it('returns the value directly when it is a valid release type', () => {
        expect(parseReleaseType('patch')).toBe('patch');
        expect(parseReleaseType('minor')).toBe('minor');
        expect(parseReleaseType('major')).toBe('major');
    });

    it('maps numeric strings to release types', () => {
        expect(parseReleaseType('1')).toBe('patch');
        expect(parseReleaseType('2')).toBe('minor');
        expect(parseReleaseType('3')).toBe('major');
    });

    it('returns null for unrecognised input', () => {
        expect(parseReleaseType('4')).toBeNull();
        expect(parseReleaseType('hotfix')).toBeNull();
        expect(parseReleaseType('')).toBeNull();
    });
});
