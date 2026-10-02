/**
 * A short identifier for one customer's visit, shown on the error card so a customer can quote it
 * and support can find their logs.
 *
 * It is persisted in `sessionStorage` rather than kept in memory: payment flows leave the page for
 * 3DS and come back, and the error card's "Try again" reloads it. A reference that was reborn on
 * every load would name only the last fragment of the attempt the customer is telling us about.
 */

const STORAGE_KEY = 'solvimon.sdk.session-reference';
const PREFIX = 'SV';
const LENGTH = 8;

/**
 * Crockford-flavoured: no `I`, `O`, `0` or `1`, so a reference read down a phone line or retyped
 * from a screenshot cannot come back as a different one. Exactly 32 symbols, which is what lets
 * `& 31` pick one from a random byte without bias.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const REFERENCE_PATTERN = new RegExp(`^${PREFIX}-[${ALPHABET}]{${LENGTH}}$`);

/** Within one page, every caller gets the same reference even when storage is unavailable. */
let cached: string | undefined;

function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);

    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
        return bytes;
    }

    // Only reached in an environment without Web Crypto. The reference labels a log entry rather
    // than guarding anything, so a weaker source is better than no reference at all.
    for (let index = 0; index < length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
    }
    return bytes;
}

export function createSessionReference(): string {
    const suffix = Array.from(randomBytes(LENGTH), (byte) => ALPHABET[byte & 31]).join('');
    return `${PREFIX}-${suffix}`;
}

/**
 * Reading and writing `sessionStorage` both throw outright in a sandboxed iframe and in browsers
 * set to block site data, so neither is allowed to take the SDK down with it.
 */
function readStoredReference(): string | undefined {
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        return stored && REFERENCE_PATTERN.test(stored) ? stored : undefined;
    } catch {
        return undefined;
    }
}

function writeStoredReference(reference: string): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, reference);
    } catch {
        // Kept in `cached` for this page instead; a later load simply starts a new reference.
    }
}

/** The reference for this visit, created on first use and stable for the rest of the session. */
export function getSessionReference(): string {
    if (cached) {
        return cached;
    }

    const stored = readStoredReference();
    cached = stored ?? createSessionReference();

    if (!stored) {
        writeStoredReference(cached);
    }

    return cached;
}

/** Drops the in-memory and stored reference. Exists for tests, which need a fresh session. */
export function resetSessionReference(): void {
    cached = undefined;
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing was stored to begin with.
    }
}
