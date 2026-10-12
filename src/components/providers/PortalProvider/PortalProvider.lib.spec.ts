import { getPortalUnavailableReason } from './PortalProvider.lib';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

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

    it('has nothing to check without a portal object', () => {
        expect(getPortalUnavailableReason(undefined)).toBe('missing');
    });
});
