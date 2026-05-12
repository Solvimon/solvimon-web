import { jwtDecode } from 'jwt-decode';
import { getAccessTokenParsed } from './accessToken';

vi.mock('jwt-decode');

describe('getAccessTokenParsed', () => {
    it('returns the decoded JWT for a valid token', () => {
        const mockPayload = { sub: 'user_123', exp: 9999999999, iat: 1000000000 };
        vi.mocked(jwtDecode).mockReturnValue(mockPayload);

        const result = getAccessTokenParsed('valid.jwt.token');

        expect(jwtDecode).toHaveBeenCalledWith('valid.jwt.token');
        expect(result).toEqual(mockPayload);
    });

    it('returns undefined when jwtDecode throws', () => {
        vi.mocked(jwtDecode).mockImplementation(() => {
            throw new Error('Invalid token specified');
        });

        const result = getAccessTokenParsed('not-a-jwt');

        expect(result).toBeUndefined();
    });
});
