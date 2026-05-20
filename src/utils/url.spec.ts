import { getQueryParam, sanitizeUrl } from './url';

describe('url utils', () => {
    describe('getQueryParam', () => {
        it('should return the correct value for a given query param', () => {
            const search = '?foo=bar&baz=qux';
            expect(getQueryParam('foo', search)).toBe('bar');
            expect(getQueryParam('baz', search)).toBe('qux');
        });

        it('should return null if the query param is not present', () => {
            const search = '?foo=bar';
            expect(getQueryParam('missing', search)).toBeNull();
        });

        it('should default to window.location.search if no search string is provided', () => {
            const originalSearch = window.location.search;

            // Use defineProperty to safely override search
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { ...window.location, search: '?test=value' },
            });

            expect(getQueryParam('test')).toBe('value');

            // Restore original search
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { ...window.location, search: originalSearch },
            });
        });

        it('should return null if param is not in window.location.search', () => {
            const originalSearch = window.location.search;

            Object.defineProperty(window, 'location', {
                writable: true,
                value: { ...window.location, search: '?only=this' },
            });

            expect(getQueryParam('missing')).toBeNull();

            Object.defineProperty(window, 'location', {
                writable: true,
                value: { ...window.location, search: originalSearch },
            });
        });
    });

    describe('sanitizeUrl', () => {
        it('passes through a valid https URL', () => {
            expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
        });

        it('passes through a valid http URL', () => {
            expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
        });

        it('returns an empty string for a javascript: URI', () => {
            expect(sanitizeUrl('javascript:alert(1)')).toBe('');
        });

        it('returns an empty string for a data: URI', () => {
            expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
        });

        it('returns an empty string for a vbscript: URI', () => {
            expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('');
        });

        it('returns an empty string for a relative URL', () => {
            expect(sanitizeUrl('/relative/path')).toBe('');
        });

        it('returns an empty string for an empty string', () => {
            expect(sanitizeUrl('')).toBe('');
        });

        it('returns an empty string for a non-URL string', () => {
            expect(sanitizeUrl('not a url')).toBe('');
        });
    });
});
