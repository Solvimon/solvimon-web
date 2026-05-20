const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Reads a single query parameter from the current URL search string.
 * Pass `locationSearch` to parse a specific query string, for example in tests.
 */
export function getQueryParam(name: string, locationSearch = window.location.search) {
    const currentUrl = new URLSearchParams(locationSearch);
    return currentUrl.get(name);
}

/**
 * Returns the URL only when it is absolute and uses an allowed protocol.
 * Invalid URLs and unsafe protocols return an empty string.
 */
export function sanitizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (!SAFE_PROTOCOLS.has(parsed.protocol)) return '';
        return url;
    } catch {
        return '';
    }
}

/**
 * Redirects to the given URL only if it passes sanitization.
 * Silently does nothing when the URL is unsafe or invalid.
 */
export function safeUrlRedirect(url: string): void {
    const safe = sanitizeUrl(url);
    if (safe) window.location.replace(safe);
}
