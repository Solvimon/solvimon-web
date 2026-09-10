import type {
    PaymentAcceptor,
    PaymentIntegration,
    PaymentMethodOptionResponseEntry,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';

const createAdyenGateway = (): PaymentIntegration['payment_gateway'] => ({
    variant: 'ADYEN',
    adyen: {
        company_account: 'TestCompany',
        environment: 'TEST',
        merchant_accounts: ['TestMerchant'],
        public_key: 'test-client-key',
        live_prefix: '',
        ownership: 'SYSTEM',
    },
});

const createStripeGateway = (publicKey?: string): PaymentIntegration['payment_gateway'] => ({
    variant: 'STRIPE',
    ...(publicKey ? { stripe: { public_key: publicKey } } : {}),
});

/**
 * A payment-method-options entry as the API returns it. `options` is optional in the contract and
 * LIVE has been seen to omit it entirely, so specs need the payable shape and that one both.
 */
export function createPaymentMethodOptionEntry({
    paymentAcceptorId = 'paya_123',
    integrationId = 'int_123',
    gateway = 'ADYEN',
    withoutStripePublicKey = false,
    options = [
        {
            name: 'Card',
            payment_method_variant: 'CARD',
            payment_gateway_variant: 'ADYEN',
            adyen: { name: 'Card', type: 'scheme', brands: ['visa', 'mc'] },
        },
    ],
}: {
    paymentAcceptorId?: string;
    integrationId?: string;
    gateway?: 'ADYEN' | 'STRIPE';
    /** Leaves the Stripe frame with no key to mount against, so the entry renders nothing. */
    withoutStripePublicKey?: boolean;
    options?: PaymentMethodOptionResponseEntry['options'];
} = {}): PaymentMethodOptionResponseEntry {
    return {
        payment_acceptor: {
            id: paymentAcceptorId,
            object_type: 'PAYMENT_ACCEPTOR',
            name: 'Test Acceptor',
            reference: 'test-ref',
            status: 'ACTIVE',
        } satisfies PaymentAcceptor,
        integration: {
            id: integrationId,
            object_type: 'INTEGRATION',
            reference: 'int-ref',
            name: 'Test Integration',
            description: '',
            status: 'ACTIVE',
            type: 'PAYMENT_GATEWAY',
            payment_gateway:
                gateway === 'ADYEN'
                    ? createAdyenGateway()
                    : createStripeGateway(withoutStripePublicKey ? undefined : 'pk_test'),
        } satisfies PaymentIntegration,
        options,
    };
}

/**
 * The key is deleted rather than set to `undefined`: absent is what the wire sends, and what `?? []`
 * quietly swallowed.
 */
export function createPaymentMethodOptionsResponseWithoutOptions(
    overrides: Parameters<typeof createPaymentMethodOptionEntry>[0] = {},
): PaymentMethodOptionsResponse {
    const { options: _options, ...entry } = createPaymentMethodOptionEntry(overrides);

    return [entry];
}
