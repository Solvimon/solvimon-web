import type { InjectionKey, Ref } from 'vue';
import type { PortalUrl } from '@solvimon/solvimon-types';

export const PORTAL_INJECTION_KEY: InjectionKey<Readonly<Ref<PortalUrl>>> = Symbol('portalObject');

export type PortalUnavailableReason = 'missing' | 'type-not-allowed' | 'not-published';

/**
 * Why an element cannot use the portal object it was given, or `undefined` when it can. Every
 * request the tree below makes is on the portal's behalf, so a portal of another type or one that
 * was revoked must stop the element before any of them go out.
 */
export function getPortalUnavailableReason(
    portalObject: PortalUrl | undefined,
    allowedPortalTypes?: PortalUrl['type'][],
): PortalUnavailableReason | undefined {
    if (!portalObject) return 'missing';
    if (allowedPortalTypes && !allowedPortalTypes.includes(portalObject.type)) {
        return 'type-not-allowed';
    }
    if (portalObject.status !== 'PUBLISHED') return 'not-published';

    return undefined;
}
