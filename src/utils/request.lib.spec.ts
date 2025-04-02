import { getDefaultHeaders } from "./request.lib";

describe('request lib', () => {
    describe('getDefaultHeaders() util', () => {
        const TOKEN = 'some-token-123';

        it('returns the default headers when there are no overrides', () => {
            const result = getDefaultHeaders({ token: TOKEN });

            expect(result).toEqual('')
        });

        it('returns additional headers when overrides are not matching current headers', () => {
            const CUSTOM_HEADERS = {
                'custom-header-one': 'some value',
                'custom-header-two': 'another value'
            };
            const result = getDefaultHeaders({ token: TOKEN, headers: CUSTOM_HEADERS });

            expect(result).toEqual('')
        });

        it('returns overridden headers when the headers are matching current headers', () => {
            const TOKEN_OVERRIDE = 'overridden-token-value-123';
            const result = getDefaultHeaders({ token: TOKEN, headers: { token: TOKEN_OVERRIDE } });

            expect(result).toEqual('')
        });
    })
})

