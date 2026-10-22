import type { PortalUrl } from '@solvimon/solvimon-types';
import { getPortalAuthentication, parsePortalCredential, parseToken } from './token';

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

    describe('parsePortalCredential() util', () => {
        const handle = `cHVybF8x.${'a'.repeat(43)}`;

        it('reads an identity token for its user', () => {
            expect(parsePortalCredential(btoa('user123.purl_1'))).toEqual({
                kind: 'identity',
                tokenUserName: 'user123',
            });
        });

        it('takes a handle as it is, without decoding it', () => {
            expect(parsePortalCredential(handle, 'SIGNED_TOKEN')).toEqual({
                kind: 'handle',
                handle,
            });
        });

        it('does not read a handle as an identity token', () => {
            expect(() => parsePortalCredential(handle)).toThrowError('Invalid token');
        });

        it.each([
            ['empty', ''],
            ['without a dot', 'cHVybF8x'],
            ['with two dots', 'a.b.c'],
            ['with whitespace', 'cHVy bF8x.abc'],
            ['with base64 padding', 'cHVybF8x=.abc'],
            ['longer than 512 characters', `a.${'b'.repeat(511)}`],
        ])('refuses a handle that is %s', (_, value) => {
            expect(() => parsePortalCredential(value, 'SIGNED_TOKEN')).toThrowError(
                'Invalid token',
            );
        });
    });

    describe('getPortalAuthentication() util', () => {
        const portalObject = (fields: object) => ({ id: 'purl_1', ...fields }) as PortalUrl;

        it('reads a signed-token link', () => {
            expect(getPortalAuthentication(portalObject({ authentication: 'SIGNED_TOKEN' }))).toBe(
                'SIGNED_TOKEN',
            );
        });

        it.each([
            ['an identity-token link', { authentication: 'IDENTITY_TOKEN' }],
            ['a portal object from before the field existed', {}],
            ['an unknown value', { authentication: 'SOMETHING_ELSE' }],
        ])('treats %s as identity', (_, fields) => {
            expect(getPortalAuthentication(portalObject(fields))).toBe('IDENTITY_TOKEN');
        });
    });
});
