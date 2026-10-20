import { randomBytes } from '@/utils/sessionReference';

/**
 * A version 4 UUID. `crypto.randomUUID` exists only in secure contexts and recent browsers, and
 * the SDK also runs on plain-http host pages, so it is built from random bytes instead.
 */
export function randomUuid(): string {
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
