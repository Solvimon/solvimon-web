import type {
    PaymentAuthorizationContext,
    PaymentIntegrationVariantEmits,
    PaymentIntegrationVariantProps,
} from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

export type { PaymentAuthorizationContext };

export interface PaymentIntegrationFormStripeProps extends PaymentIntegrationVariantProps {
    email?: string;
    name?: string;
}

export type PaymentIntegrationFormStripeEmits = PaymentIntegrationVariantEmits;
