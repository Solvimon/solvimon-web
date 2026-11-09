import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import ExpressPaymentMethods from './ExpressPaymentMethods.vue';

const ApplePayStub = defineComponent({
    name: 'ExpressPaymentMethodApplePay',
    props: { isVisible: Boolean },
    emits: ['ready', 'unavailable'],
    setup: (props) => () =>
        h('div', { class: 'apple-pay', 'data-visible': String(props.isVisible) }),
});

const optionsWith = (name: string, variant = 'ADYEN') =>
    [
        { options: [{ name, payment_gateway_variant: variant }] },
    ] as unknown as PaymentMethodOptionsResponse;

const mountWith = (paymentMethodsOptionsResponse: PaymentMethodOptionsResponse | undefined) =>
    mount(ExpressPaymentMethods, {
        props: {
            amount: { quantity: '10', currency: 'EUR' },
            countryCode: 'NL',
            locale: 'en-US',
            paymentMethodsOptionsResponse,
            billingInformation: undefined,
            onBillingInformationChange: vi.fn(),
        } as never,
        global: { stubs: { ExpressPaymentMethodApplePay: ApplePayStub } },
    });

const applePay = (wrapper: ReturnType<typeof mountWith>) =>
    wrapper.findComponent({ name: 'ExpressPaymentMethodApplePay' });

describe('ExpressPaymentMethods', () => {
    it('renders nothing without an Apple Pay option on Adyen', () => {
        expect(mountWith(optionsWith('Card')).html()).toBe('<!--v-if-->');
        expect(mountWith(optionsWith('Apple Pay', 'STRIPE')).html()).toBe('<!--v-if-->');
        expect(mountWith(undefined).html()).toBe('<!--v-if-->');
    });

    it('holds a placeholder in the button’s place until Apple Pay is ready', async () => {
        const wrapper = mountWith(optionsWith('Apple Pay'));

        expect(applePay(wrapper).props('isVisible')).toBe(false);
        expect(wrapper.findAll('.h-11')).toHaveLength(1);

        await applePay(wrapper).vm.$emit('ready');

        expect(applePay(wrapper).props('isVisible')).toBe(true);
        expect(wrapper.findAll('.h-11')).toHaveLength(0);
        expect(wrapper.text()).toContain('Subscribe instantly with');
    });

    it('leaves the block out once Apple Pay turns out to be unavailable', async () => {
        const wrapper = mountWith(optionsWith('Apple Pay'));

        await applePay(wrapper).vm.$emit('unavailable');

        expect(wrapper.html()).toBe('<!--v-if-->');
    });
});
