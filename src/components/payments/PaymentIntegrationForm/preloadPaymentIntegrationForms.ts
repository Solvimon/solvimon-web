import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import {
    isAdyenPaymentIntegration,
    isStripePaymentIntegration,
} from './PaymentIntegrationForm.lib';
import {
    loadAdyenPaymentIntegrationForm,
    loadStripePaymentIntegrationForm,
} from './paymentIntegrationFormLoaders';
import { loadAdyen } from '@/utils/adyenSdk';

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
        loads.push(loadAdyenPaymentIntegrationForm(), loadAdyen());
    }

    if (options.some(isStripePaymentIntegration)) {
        loads.push(loadStripePaymentIntegrationForm());
    }

    await Promise.allSettled(loads);
}
