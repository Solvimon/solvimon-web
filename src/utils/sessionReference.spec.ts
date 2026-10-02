import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createSessionReference,
    getSessionReference,
    resetSessionReference,
} from './sessionReference';

const REFERENCE_PATTERN = /^SV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

describe('createSessionReference', () => {
    it('builds a prefixed reference of eight symbols', () => {
        expect(createSessionReference()).toMatch(REFERENCE_PATTERN);
    });

    it('leaves out the characters a customer would misread', () => {
        const references = Array.from({ length: 200 }, () => createSessionReference());
        expect(references.join('').slice(3)).not.toMatch(/[IO01]/);
    });

    it('does not repeat itself', () => {
        const references = new Set(Array.from({ length: 100 }, () => createSessionReference()));
        expect(references.size).toBe(100);
    });
});

describe('getSessionReference', () => {
    beforeEach(() => {
        resetSessionReference();
        vi.restoreAllMocks();
    });

    it('returns the same reference for the rest of the session', () => {
        expect(getSessionReference()).toBe(getSessionReference());
    });

    it('stores the reference so a redirect back to the page keeps it', () => {
        const reference = getSessionReference();

        // A reload loses the module state but not the storage.
        resetInMemoryOnly(reference);

        expect(getSessionReference()).toBe(reference);
    });

    it('starts a new reference when the stored one is not one of ours', () => {
        window.sessionStorage.setItem('solvimon.sdk.session-reference', 'not-a-reference');
        resetInMemoryOnly();

        expect(getSessionReference()).toMatch(REFERENCE_PATTERN);
    });

    it('still hands out a reference when storage is unavailable', () => {
        // Spied on the prototype: jsdom's own `sessionStorage` properties are not configurable.
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('The operation is insecure.');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('The operation is insecure.');
        });

        const reference = getSessionReference();

        expect(reference).toMatch(REFERENCE_PATTERN);
        expect(getSessionReference()).toBe(reference);
    });
});

/** Drops the memoised value while leaving `sessionStorage` as it is, the way a reload would. */
function resetInMemoryOnly(storedReference?: string) {
    const stored =
        storedReference ?? window.sessionStorage.getItem('solvimon.sdk.session-reference');
    resetSessionReference();
    if (stored) {
        window.sessionStorage.setItem('solvimon.sdk.session-reference', stored);
    }
}
