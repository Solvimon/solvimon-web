import { mount } from '@vue/test-utils';
import type {
    PaymentAcceptor,
    PaymentIntegration,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/solvimon-types';
import SecurePaymentsKPI from './SecurePaymentsKPI.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        useIntl: () => ({ $t: (msg: { defaultMessage: string }) => msg.defaultMessage }),
    };
});

vi.mock('@/assets/images/vendors/adyen-logo.svg?raw', () => ({
    default: '<svg data-vendor="adyen" />',
}));
vi.mock('@/assets/images/vendors/stripe-logo.svg?raw', () => ({
    default: '<svg data-vendor="stripe" />',
}));

function makeAcceptor(): PaymentAcceptor {
    return {
        object_type: 'PAYMENT_ACCEPTOR',
        id: 'pa-1',
        name: 'Test Acceptor',
        reference: 'ref',
        status: 'ACTIVE',
    } satisfies PaymentAcceptor;
}

function makeIntegration(variant: 'ADYEN' | 'STRIPE'): PaymentIntegration {
    return {
        id: 'int-1',
        object_type: 'INTEGRATION',
        reference: 'ref',
        name: 'Test Integration',
        description: '',
        status: 'ACTIVE',
        type: 'PAYMENT_GATEWAY',
        payment_gateway: { variant },
    } satisfies PaymentIntegration;
}

function makeEntry(variant: 'ADYEN' | 'STRIPE'): PaymentMethodOptionResponseEntry {
    return { payment_acceptor: makeAcceptor(), integration: makeIntegration(variant) };
}

const stubs = { Icon: true, Typography: { template: '<span><slot /></span>' } };

describe('SecurePaymentsKPI', () => {
    it('shows generic text when options are empty', () => {
        const wrapper = mount(SecurePaymentsKPI, {
            props: { paymentMethodOptions: [] },
            global: { stubs },
        });
        expect(wrapper.text()).toContain('Secure and encrypted payments');
        expect(wrapper.find('[role="img"]').exists()).toBe(false);
    });

    it('shows vendor text and Adyen logo when ADYEN variant is present', () => {
        const wrapper = mount(SecurePaymentsKPI, {
            props: { paymentMethodOptions: [makeEntry('ADYEN')] },
            global: { stubs },
        });
        expect(wrapper.text()).toContain('Secure and encrypted payments by');
        const logo = wrapper.find('[role="img"]');
        expect(logo.exists()).toBe(true);
        expect(logo.attributes('aria-label')).toBe('Adyen');
        expect(logo.html()).toContain('data-vendor="adyen"');
    });

    it('shows vendor text and Stripe logo when STRIPE variant is present', () => {
        const wrapper = mount(SecurePaymentsKPI, {
            props: { paymentMethodOptions: [makeEntry('STRIPE')] },
            global: { stubs },
        });
        expect(wrapper.text()).toContain('Secure and encrypted payments by');
        const logo = wrapper.find('[role="img"]');
        expect(logo.exists()).toBe(true);
        expect(logo.attributes('aria-label')).toBe('Stripe');
        expect(logo.html()).toContain('data-vendor="stripe"');
    });

    it('uses the first matching entry when multiple options are provided', () => {
        const wrapper = mount(SecurePaymentsKPI, {
            props: { paymentMethodOptions: [makeEntry('STRIPE'), makeEntry('ADYEN')] },
            global: { stubs },
        });
        expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Stripe');
    });

});
