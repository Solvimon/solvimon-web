import { parseToken } from './token';

describe('token utils', () => {
    describe('parseToken() util', () => {
        const encodeToken = (username: string, resourceId: string): string => {
            const raw = `${username}.${resourceId}`;
            return btoa(raw);
        };

        it('parses a valid base64-encoded token with one delimiter', () => {
            const token = encodeToken('user123', 'portal-abc');
            const result = parseToken(token);
            expect(result).toEqual({
                tokenUserName: 'user123',
                portalUrlResourceId: 'portal-abc',
            });
        });

        it('throws an error if token is not valid base64', () => {
            expect(() => parseToken('!@#notbase64')).toThrowError('Invalid token');
        });

        it('throws an error if decoded token has no delimiter', () => {
            const badToken = btoa('missingdelimiter');
            expect(() => parseToken(badToken)).toThrowError('Invalid token');
        });

        it('parses token with empty username or resource ID', () => {
            const token1 = encodeToken('', 'res123');
            const token2 = encodeToken('user456', '');
            expect(parseToken(token1)).toEqual({
                tokenUserName: '',
                portalUrlResourceId: 'res123',
            });
            expect(parseToken(token2)).toEqual({
                tokenUserName: 'user456',
                portalUrlResourceId: '',
            });
        });
    });
});
