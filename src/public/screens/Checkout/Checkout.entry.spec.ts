import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import CheckoutEntry from './Checkout.entry.vue';

vi.mock('@/components/providers', () => ({
    EntryProvider: defineComponent({
        name: 'EntryProviderStub',
        setup:
            (_props, { slots }) =>
            () =>
                h('div', slots.default?.()),
    }),
}));

vi.mock('@/public/screens/Checkout/Checkout.vue', () => ({
    default: defineComponent({
        name: 'CheckoutStub',
        props: { configuration: { type: Object, required: true }, avatar: String },
        setup: () => () => h('div'),
    }),
}));

const mountWithSearch = (search: string, couponCode?: string) => {
    window.history.replaceState(null, '', `/checkout${search}`);
    return mount(CheckoutEntry, {
        props: { configuration: couponCode ? { couponCode } : undefined } as never,
    });
};

const passedCouponCode = (wrapper: ReturnType<typeof mountWithSearch>) =>
    wrapper.findComponent({ name: 'CheckoutStub' }).props('configuration').couponCode;

const passedConfiguration = (props: Record<string, unknown>) =>
    mount(CheckoutEntry, { props: props as never })
        .findComponent({ name: 'CheckoutStub' })
        .props('configuration');

const passedAvatar = (props: Record<string, unknown>) =>
    mount(CheckoutEntry, { props: props as never })
        .findComponent({ name: 'CheckoutStub' })
        .props('avatar');

const branding = { emblem: { public_url: 'https://cdn.example/emblem.png' } };

describe('Checkout entry', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('takes a coupon code from the page URL', () => {
        expect(passedCouponCode(mountWithSearch('?coupon_code=SUMMER25'))).toBe('SUMMER25');
    });

    it('trims a coupon code from the page URL', () => {
        expect(passedCouponCode(mountWithSearch('?coupon_code=%20SUMMER25%20'))).toBe('SUMMER25');
    });

    it.each([
        ['markup', '?coupon_code=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E'],
        ['a zero-width space', '?coupon_code=SUMMER%E2%80%8B25'],
        ['an overlong value', `?coupon_code=${'a'.repeat(300)}`],
        ['an empty value', '?coupon_code='],
    ])('drops a coupon code with %s', (_, search) => {
        expect(passedCouponCode(mountWithSearch(search))).toBeUndefined();
    });

    it('prefers the code the host configured', () => {
        expect(passedCouponCode(mountWithSearch('?coupon_code=FROM_URL', 'FROM_HOST'))).toBe(
            'FROM_HOST',
        );
    });

    it('hands the checkout the payment success callback the host configured', () => {
        const onPaymentSuccess = vi.fn();

        expect(passedConfiguration({ configuration: { onPaymentSuccess } }).onPaymentSuccess).toBe(
            onPaymentSuccess,
        );
    });

    it('hands the checkout what the host configured for the form', () => {
        expect(
            passedConfiguration({
                configuration: {
                    email: 'ada@example.com',
                    countryCode: 'NL',
                    enabledPricingIds: ['pri_1'],
                },
            }),
        ).toMatchObject({
            email: 'ada@example.com',
            countryCode: 'NL',
            enabledPricingIds: ['pri_1'],
        });
    });

    it('shows the branding emblem as the avatar', () => {
        expect(passedAvatar({ branding })).toBe('https://cdn.example/emblem.png');
    });

    it('shows no avatar without a branding emblem', () => {
        expect(passedAvatar({})).toBeUndefined();
    });
});
