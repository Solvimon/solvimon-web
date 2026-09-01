import { getMediaType } from './requests.lib';

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
