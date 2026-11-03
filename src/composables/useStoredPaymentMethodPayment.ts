import { ref, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createPaymentsService, type ChargeStoredPaymentMethodPayload } from '@/services/payments';
import {
    getAuthorizeOutcome,
    isOutcomeUnknownAfterError,
    type PaymentOutcome,
} from '@/utils/paymentOutcome';

/**
 * Charges an invoice to a method the customer stored before. There is nothing for the customer to
 * do at the gateway, so the answer is final, except when it never arrives: the charge may then still
 * go through, and paying again could charge the customer twice.
 */
export function useStoredPaymentMethodPayment(): {
    isPending: Ref<boolean>;
    charge: (payload: ChargeStoredPaymentMethodPayload) => Promise<PaymentOutcome>;
} {
    const { chargeStoredPaymentMethod } = createPaymentsService();
    const logger = useLogger();

    const isPending = ref(false);

    const charge = async (payload: ChargeStoredPaymentMethodPayload): Promise<PaymentOutcome> => {
        if (isPending.value) return 'UNCONFIRMED';

        isPending.value = true;
        const context = {
            paymentAcceptorId: payload.paymentAcceptorId,
            invoiceId: payload.invoiceId,
        };

        try {
            const response = await chargeStoredPaymentMethod(payload);
            const outcome = getAuthorizeOutcome(response);

            if (outcome === 'FAILED') {
                logger.error(
                    'PAYMENT_AUTHORIZATION_FAILED',
                    'Failed to charge the invoice to a stored payment method',
                    {
                        ...context,
                        reason: 'PAYMENT_AUTHORIZATION_REJECTED',
                        status: response.status,
                    },
                );
            }

            return outcome;
        } catch (error) {
            logger.error(
                'PAYMENT_AUTHORIZATION_FAILED',
                'Failed to charge the invoice to a stored payment method',
                { ...context, reason: 'PAYMENT_AUTHORIZATION_FAILED' },
                error,
            );

            return isOutcomeUnknownAfterError(error) ? 'UNCONFIRMED' : 'FAILED';
        } finally {
            isPending.value = false;
        }
    };

    return { isPending, charge };
}
