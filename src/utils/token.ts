import type { PortalObject } from '@/types/checkoutSession';
import type { PortalAuthentication } from '@/types/portalAuthentication';

const TOKEN_DELIMITER = '.';

// The backend refuses anything else, so a value that does not look like this never goes out.
const HANDLE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const HANDLE_MAX_LENGTH = 512;

/**
 * A portal token signs in through identity; a handle, which a `SIGNED_TOKEN` link carries instead,
 * is exchanged for a portal token and never decoded.
 */
export type PortalCredential =
    | { kind: 'identity'; tokenUserName: string }
    | { kind: 'handle'; handle: string };

export function parseToken(token: string): { tokenUserName: string; portalUrlResourceId: string } {
    try {
        const decoded = atob(token);
        const delimiterIndex = decoded.lastIndexOf(TOKEN_DELIMITER);

        if (delimiterIndex === -1) {
            throw new Error('Invalid token');
        }

        const [tokenUserName, portalUrlResourceId] = [
            decoded.substring(0, delimiterIndex),
            decoded.substring(delimiterIndex + 1),
        ];

        return { tokenUserName, portalUrlResourceId };
    } catch (_err) {
        throw new Error('Invalid token');
    }
}

/** `authentication` is not in `@solvimon/solvimon-types` yet; a portal object without it is an identity link. */
export function getPortalAuthentication(portalObject: PortalObject): PortalAuthentication {
    return 'authentication' in portalObject && portalObject.authentication === 'SIGNED_TOKEN'
        ? 'SIGNED_TOKEN'
        : 'IDENTITY_TOKEN';
}

export function parsePortalCredential(
    token: string,
    authentication: PortalAuthentication = 'IDENTITY_TOKEN',
): PortalCredential {
    if (authentication === 'SIGNED_TOKEN') {
        if (token.length > HANDLE_MAX_LENGTH || !HANDLE_PATTERN.test(token)) {
            throw new Error('Invalid token');
        }
        return { kind: 'handle', handle: token };
    }

    return { kind: 'identity', tokenUserName: parseToken(token).tokenUserName };
}
