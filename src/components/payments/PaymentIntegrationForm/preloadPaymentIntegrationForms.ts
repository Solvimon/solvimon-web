import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import {
    isAdyenPaymentIntegration,
    isStripePaymentIntegration,
} from './PaymentIntegrationForm.lib';
import { loadAdyenSdk } from '@/utils/adyenSdk';

/**
 * Loads the code the payment forms for these options need, so a modal can open once its form is
 * ready instead of growing as each piece arrives. A failure is left to the form itself, which loads
 * the same modules and reports it.
 */
export async function preloadPaymentIntegrationForms(
    options: PaymentMethodOptionsResponse,
): Promise<void> {
    const loads: Promise<unknown>[] = [];

    if (options.some(isAdyenPaymentIntegration)) {
        loads.push(
            import('@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue'),
            loadAdyenSdk(),
            import('@adyen/adyen-web/styles/adyen.css?inline'),
        );
    }

    if (options.some(isStripePaymentIntegration)) {
        loads.push(
            import('@/components/payments/PaymentIntegrationFormStripe/PaymentIntegrationFormStripe.vue'),
        );
    }

    await Promise.allSettled(loads);
}
