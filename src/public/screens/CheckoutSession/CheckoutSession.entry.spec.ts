import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import CheckoutSessionEntry from './CheckoutSession.entry.vue';

const { ending } = vi.hoisted(() => ({
    ending: { current: undefined as object | undefined },
}));

vi.mock('@/components/providers', () => ({
    EntryProvider: defineComponent({
        name: 'EntryProviderStub',
        setup:
            (_props, { slots }) =>
            () =>
                h('div', slots['portal-unavailable']?.({ ending: ending.current })),
    }),
}));

vi.mock('./SessionCheckout.vue', () => ({
    default: defineComponent({ setup: () => () => h('div') }),
}));

const mountEntry = () =>
    mount(CheckoutSessionEntry, {
        props: { portalObject: { id: 'purl_1' } } as never,
    });

describe('Checkout session entry', () => {
    it.each([
        [{ reason: 'expired' }, 'This checkout link has expired'],
        [{ reason: 'revoked' }, 'This checkout is no longer available'],
        [
            { reason: 'closed', checkoutSessionStatus: 'COMPLETED' },
            'This checkout has been completed',
        ],
        [{ reason: 'closed', checkoutSessionStatus: 'FAILED' }, 'We received your payment'],
        [{ reason: 'closed', checkoutSessionStatus: 'OPEN' }, 'This checkout is closed'],
        [{ reason: 'closed' }, 'This checkout is closed'],
    ])('says why a link that ended %o can no longer be used', (state, title) => {
        ending.current = { state: 'ended', ...state };

        const text = mountEntry().text();

        expect(text).toContain(title);
        expect(text).not.toContain('Checkout not available');
    });

    it('shows the checkout notice for a link that is unavailable for any other reason', () => {
        ending.current = undefined;

        expect(mountEntry().text()).toContain('Checkout not available');
    });
});
