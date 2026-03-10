import { getQueryParam } from './url';

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
});
