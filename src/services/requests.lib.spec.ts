import { buildUrl, getMediaType } from './requests.lib';

describe('getMediaType', () => {
    it('returns the media type of a bare header', () => {
        expect(getMediaType('application/json')).toBe('application/json');
    });

    it('drops parameters such as charset', () => {
        expect(getMediaType('application/json; charset=utf-8')).toBe('application/json');
        expect(getMediaType('text/html;charset=ISO-8859-1')).toBe('text/html');
    });

    it('lowercases the media type', () => {
        expect(getMediaType('Application/JSON')).toBe('application/json');
    });

    it('trims surrounding whitespace', () => {
        expect(getMediaType('  application/pdf  ')).toBe('application/pdf');
    });

    it('returns an empty string when the header is absent', () => {
        expect(getMediaType(null)).toBe('');
        expect(getMediaType(undefined)).toBe('');
        expect(getMediaType('')).toBe('');
    });
});

describe('buildUrl', () => {
    const BASE = 'https://api.test/v1';

    it('appends each segment to the base path', () => {
        expect(buildUrl(BASE, 'portal', 'customers', 'cus_1')).toBe(
            'https://api.test/v1/portal/customers/cus_1',
        );
    });

    it('keeps the base path whether or not it ends in a slash', () => {
        expect(buildUrl('https://api.test/v1/', 'portal')).toBe('https://api.test/v1/portal');
        expect(buildUrl('https://api.test', 'portal')).toBe('https://api.test/portal');
    });

    it.each([
        ['../../oauth/token', '..%2F..%2Foauth%2Ftoken'],
        ['cus_1/../../oauth', 'cus_1%2F..%2F..%2Foauth'],
        ['%2e%2e', '%252e%252e'],
        ['%2E%2E%2Fadmin', '%252E%252E%252Fadmin'],
        ['a/b', 'a%2Fb'],
        ['a?expand=all', 'a%3Fexpand%3Dall'],
        ['a#fragment', 'a%23fragment'],
        ['<script>alert(1)</script>', '%3Cscript%3Ealert(1)%3C%2Fscript%3E'],
        ['a\\b', 'a%5Cb'],
        ['ünïcödé ✓', '%C3%BCn%C3%AFc%C3%B6d%C3%A9%20%E2%9C%93'],
        ['...', '...'],
    ])('keeps %s to a single segment', (segment, encoded) => {
        const url = new URL(buildUrl(BASE, 'portal', 'customers', segment, 'wallets'));

        expect(url.origin).toBe('https://api.test');
        expect(url.pathname).toBe(`/v1/portal/customers/${encoded}/wallets`);
        expect(url.search).toBe('');
        expect(url.hash).toBe('');
    });

    it('keeps a very long segment whole', () => {
        const segment = 'x'.repeat(10_000);
        expect(buildUrl(BASE, segment)).toBe(`${BASE}/${segment}`);
    });

    it.each(['', '.', '..', undefined, null])('throws on the segment %j', (segment) => {
        expect(() => buildUrl(BASE, 'portal', segment as string)).toThrow(
            'Invalid URL path segment',
        );
    });

    it('throws on a segment that cannot be encoded', () => {
        expect(() => buildUrl(BASE, '\uD800')).toThrow();
    });
});
