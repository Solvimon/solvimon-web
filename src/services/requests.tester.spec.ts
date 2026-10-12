import type { Mock } from 'vitest';
import { createRequestService } from './requests';
import { buildUrl, isRefreshCookieEndpoint } from './requests.lib';

vi.mock('@/components/providers/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ accessToken: { value: 'token' } })),
}));
vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        capture: vi.fn(),
    }),
}));

const BASE = 'https://api.test/v1';

/** The segments a request to `url` names, decoded the way a server routing on them would. */
const segmentsOf = (url: string) => new URL(url).pathname.split('/').slice(1);

describe('buildUrl against hostile ids', () => {
    it.each([
        '../',
        '..%2f',
        '..%2F',
        '%2e%2e',
        '%2E%2E',
        '%252e%252e',
        '.%2e',
        '%2e.',
        '..\\',
        '\\..\\',
        '/',
        '\\',
        '?',
        '#',
        ';',
        '@',
        ':',
        'a;b=c',
        'user@evil.test',
        'https://evil.test/x?y#z',
        '//evil.test',
        '．．',
        '．．',
        '‥',
        '..\u0000',
        '\u0000',
        ' ..',
        '.. ',
        '...',
        '\t..',
        '..\n',
    ])('keeps %j to one segment, losslessly, with no query or fragment', (id) => {
        const url = buildUrl(BASE, 'portal', 'customers', id, 'wallets');
        const parsed = new URL(url);

        expect(parsed.origin).toBe('https://api.test');
        expect(parsed.search).toBe('');
        expect(parsed.hash).toBe('');
        const segments = segmentsOf(url);
        expect(segments).toHaveLength(5);
        expect(segments.slice(0, 3)).toEqual(['v1', 'portal', 'customers']);
        expect(segments[4]).toBe('wallets');
        expect(decodeURIComponent(segments[3])).toBe(id);
    });

    it('never lets any short id over the path alphabet step outside its segment', () => {
        const alphabet = ['.', '/', '\\', '%', '2', 'e', 'E', 'f', '?', '#', 'a'];
        const ids: string[] = [''];
        for (let length = 1; length <= 4; length += 1) {
            for (const prefix of ids.filter((id) => id.length === length - 1)) {
                for (const char of alphabet) ids.push(prefix + char);
            }
        }

        let checked = 0;
        for (const id of ids) {
            if (id === '' || id === '.' || id === '..') {
                expect(() => buildUrl(BASE, 'x', id, 'y')).toThrow('Invalid URL path segment');
                continue;
            }
            const url = buildUrl(BASE, 'x', id, 'y');
            const segments = segmentsOf(url);
            expect(segments, id).toHaveLength(4);
            expect(decodeURIComponent(segments[2]), id).toBe(id);
            expect(new URL(url).search + new URL(url).hash, id).toBe('');
            checked += 1;
        }
        expect(checked).toBeGreaterThan(15_000);
    });

    it.each(['\uD800', '\uDFFF', 'a\uD800b'])('refuses the lone surrogate in %j', (id) => {
        expect(() => buildUrl(BASE, 'x', id)).toThrow();
    });

    it.each([
        'https://api.test/v1',
        'https://api.test/v1/',
        'https://api.test/v1//',
        'https://api.test:8443/a/b',
    ])('keeps the base path of %s', (base) => {
        const url = new URL(buildUrl(base, 'portal', 'id'));
        expect(url.origin).toBe(new URL(base).origin);
        expect(url.pathname).toBe(`${new URL(base).pathname.replace(/\/+$/, '')}/portal/id`);
    });
});

describe('isRefreshCookieEndpoint look-alikes', () => {
    it.each([
        ['https://identity.test/v1/oauth/token', true],
        ['https://identity.test/v1/oauth/refresh-token', true],
        ['https://identity.test/v1/oauth/token?x=1', true],
        ['https://identity.test/v1/oauth/token#x', true],
        ['https://identity.test/v1/oauth/token/', false],
        ['https://identity.test/v1/oauth/tokenx', false],
        ['https://identity.test/v1/oauth/refresh-tokens', false],
        ['https://identity.test/v1/OAUTH/TOKEN', false],
        ['https://identity.test/oauth/token/../portal', false],
        ['https://identity.test/v1/oauth%2Ftoken', false],
        ['https://identity.test/v1/oauth/token%00', false],
        ['https://identity.test/v1/oauth/token;x', false],
    ])('%s is %s', (url, expected) => {
        expect(isRefreshCookieEndpoint(new URL(url))).toBe(expected);
    });

    // Matched on the path alone, so any origin with this suffix counts. Only the tokens service
    // opts in and its base is the hard-coded identity URL, so nothing reaches this today.
    it('matches the suffix on any origin and prefix', () => {
        expect(isRefreshCookieEndpoint(new URL('https://api.test/x/oauth/token'))).toBe(true);
    });
});

describe('credentials through the real request service', () => {
    let mockFetch: Mock;

    beforeEach(() => {
        mockFetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => ({}),
                headers: new Headers({ 'Content-Type': 'application/json' }),
            }),
        );
        global.fetch = mockFetch;
    });

    const credentialsFor = async (
        url: string,
        settings: Parameters<typeof createRequestService>[0],
    ) => {
        await createRequestService(settings)({ url, options: { method: 'POST' } });
        return mockFetch.mock.calls.at(-1)?.[1].credentials;
    };

    it.each([
        'https://identity.solvimon.com/v1/oauth/token',
        'https://identity.solvimon.com/v1/oauth/refresh-token',
    ])('omits them from %s for every service that does not opt in', async (url) => {
        expect(await credentialsFor(url, undefined)).toBe('omit');
        expect(await credentialsFor(url, {})).toBe('omit');
        expect(await credentialsFor(url, { enableAccessCheck: false })).toBe('omit');
        expect(await credentialsFor(url, { includeRefreshCookie: false })).toBe('omit');
    });

    it.each([
        'https://identity.solvimon.com/v1/oauth/token/',
        'https://identity.solvimon.com/v1/oauth/tokenx',
        'https://identity.solvimon.com/v1/oauth/token/../../portal/customers/cus_1',
        'https://identity.solvimon.com/v1/portal/customers',
    ])('omits them from %s even for the tokens service', async (url) => {
        expect(
            await credentialsFor(url, { enableAccessCheck: false, includeRefreshCookie: true }),
        ).toBe('omit');
    });

    it('omits them from a query that names the token path', async () => {
        const request = createRequestService({
            enableAccessCheck: false,
            includeRefreshCookie: true,
        });
        await request({
            url: 'https://identity.solvimon.com/v1/portal/customers',
            query: { next: '/oauth/token' },
        });
        expect(mockFetch.mock.calls[0][1].credentials).toBe('omit');
    });
});
