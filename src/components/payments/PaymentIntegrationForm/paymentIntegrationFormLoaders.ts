/**
 * The gateway forms, loaded on demand. The payment form and anything that loads them ahead both go
 * through here, so they always load the same modules.
 */
export const loadAdyenPaymentIntegrationForm = () =>
    import('@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue').then(
        (module) => module.default,
    );

export const loadStripePaymentIntegrationForm = () =>
    import('@/components/payments/PaymentIntegrationFormStripe/PaymentIntegrationFormStripe.vue').then(
        (module) => module.default,
    );
