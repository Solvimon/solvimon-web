import { describe, it, expect } from 'vitest';
import { isReleaseType, parseReleaseType } from './bump-version.mjs';

describe('isReleaseType', () => {
    it('returns true for valid release types', () => {
        expect(isReleaseType('patch')).toBe(true);
        expect(isReleaseType('minor')).toBe(true);
        expect(isReleaseType('major')).toBe(true);
        expect(isReleaseType('prerelease')).toBe(true);
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
        expect(parseReleaseType('prerelease')).toBe('prerelease');
    });

    it('maps numeric strings to release types', () => {
        expect(parseReleaseType('1')).toBe('patch');
        expect(parseReleaseType('2')).toBe('minor');
        expect(parseReleaseType('3')).toBe('major');
        expect(parseReleaseType('4')).toBe('prerelease');
    });

    it('leaves the existing numbers meaning what they always meant', () => {
        // Someone reaching for 1 expects patch. Adding prerelease at the front would have made it
        // cut a different release than the one they asked for.
        expect(parseReleaseType('1')).toBe('patch');
    });

    it('returns null for unrecognised input', () => {
        expect(parseReleaseType('5')).toBeNull();
        expect(parseReleaseType('hotfix')).toBeNull();
        expect(parseReleaseType('')).toBeNull();
    });
});
