import { jwtDecode } from 'jwt-decode';
import type { JWT } from '@solvimon/types';

export const getAccessTokenParsed = (token: string): JWT | undefined => {
    try {
        return jwtDecode(token);
    } catch {
        return undefined;
    }
};