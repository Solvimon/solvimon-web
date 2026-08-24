import type {
    PaymentAuthorizationContext,
    PaymentIntegrationVariantEmits,
    PaymentIntegrationVariantProps,
} from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

export interface PaymentIntegrationFormAdyenProps extends PaymentIntegrationVariantProps {
    /** Adyen always authorizes against a context, so unlike the shared shape this is required. */
    context: PaymentAuthorizationContext;
}

export type PaymentIntegrationFormAdyenEmits = PaymentIntegrationVariantEmits;
