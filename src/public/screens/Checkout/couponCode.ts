/** The API's limit on a coupon reference; a code longer than that names nothing. */
const MAX_COUPON_CODE_LENGTH = 256;

/** No whitespace, and no control, format or unassigned characters such as zero-width spaces. */
const COUPON_CODE_PATTERN = /^[^\s\p{C}]+$/u;

/**
 * A coupon code read from the page URL, trimmed, or `undefined` when it cannot be one. Anyone can
 * put a link to the checkout in front of a customer, so the query string is not taken on trust.
 */
export function sanitizeCouponCode(value: string | null | undefined): string | undefined {
    const code = value?.trim();
    if (!code || code.length > MAX_COUPON_CODE_LENGTH || !COUPON_CODE_PATTERN.test(code)) {
        return undefined;
    }
    return code;
}
