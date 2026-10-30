import { getPortalUnavailableReason } from './PortalProvider.lib';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import type { CheckoutSessionPortalUrl } from '@/types/checkoutSession';

const checkoutSessionPortal: CheckoutSessionPortalUrl = {
    object_type: 'PORTAL_URL',
    id: 'purl_1',
    type: 'CHECKOUT_SESSION',
    status: 'PUBLISHED',
    authentication: 'SIGNED_TOKEN',
    token: 'cHVybF8x.handle',
};

describe('getPortalUnavailableReason', () => {
    it('accepts a published portal of an allowed type', () => {
        expect(getPortalUnavailableReason(createTestPortalObject(), ['CUSTOMER'])).toBeUndefined();
    });

    it('accepts any published portal when the element names no types', () => {
        expect(getPortalUnavailableReason(createTestPortalObject())).toBeUndefined();
    });

    it('refuses a portal of a type the element does not accept', () => {
        expect(
            getPortalUnavailableReason(createTestPortalObject(), [
                'INIT_PRICING_PLAN_SUBSCRIPTION',
            ]),
        ).toBe('type-not-allowed');
    });

    it('refuses a revoked portal', () => {
        expect(
            getPortalUnavailableReason({ ...createTestPortalObject(), status: 'REVOKED' }, [
                'CUSTOMER',
            ]),
        ).toBe('not-published');
    });

    it('names the type first, since a revoked portal of the wrong type is still the wrong one', () => {
        expect(
            getPortalUnavailableReason({ ...createTestPortalObject(), status: 'REVOKED' }, [
                'INIT_PRICING_PLAN_SUBSCRIPTION',
            ]),
        ).toBe('type-not-allowed');
    });

    it('lets a closed checkout session link through, to show how the session ended', () => {
        expect(
            getPortalUnavailableReason({ ...checkoutSessionPortal, status: 'CLOSED' }, [
                'CHECKOUT_SESSION',
            ]),
        ).toBeUndefined();
    });

    it('refuses a revoked checkout session link', () => {
        expect(
            getPortalUnavailableReason({ ...checkoutSessionPortal, status: 'REVOKED' }, [
                'CHECKOUT_SESSION',
            ]),
        ).toBe('not-published');
    });

    it('has nothing to check without a portal object', () => {
        expect(getPortalUnavailableReason(undefined)).toBe('missing');
    });
});
