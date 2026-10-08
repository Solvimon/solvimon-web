import type {
    ChargeOnDemandPricingItemsPricingItemConfig,
    Invoice,
    PaymentMethod,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import { ref, type Ref } from 'vue';
import { getChargeError, type ChargeError } from './ChargeOnDemandModal.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createInvoicesService } from '@/services/invoices';
import { isApiError } from '@/services/apiError';

export type ChargeOnDemandOrderResult = { invoice: Invoice } | { error: ChargeError };

/**
 * Places an on-demand order on a schedule: charges its items to a saved payment method and
 * finalizes the invoice straight away, so the payment is taken as part of the order.
 */
export function useChargeOnDemandOrder({
    pricingPlanScheduleId,
}: {
    pricingPlanScheduleId: Ref<PricingPlanSchedule['id']>;
}) {
    const { chargeOnDemandPricingItems } = createInvoicesService();
    const logger = useLogger();

    const isCharging = ref(false);
    const chargedInvoice = ref<Invoice>();
    const chargeError = ref<ChargeError>();

    const charge = async ({
        pricingItems,
        paymentMethodId,
    }: {
        pricingItems: ChargeOnDemandPricingItemsPricingItemConfig[];
        paymentMethodId: PaymentMethod['id'];
    }): Promise<ChargeOnDemandOrderResult> => {
        isCharging.value = true;
        chargeError.value = undefined;

        try {
            const invoice = await chargeOnDemandPricingItems({
                pricing_plan_schedule_id: pricingPlanScheduleId.value,
                pricing_items: pricingItems,
                payment_method_id: paymentMethodId,
                finalize_immediately: true,
            });

            chargedInvoice.value = invoice;
            return { invoice };
        } catch (error) {
            const outcome = getChargeError(error);
            chargeError.value = outcome;

            const context = {
                scheduleId: pricingPlanScheduleId.value,
                outcome,
                ...(isApiError(error)
                    ? {
                          statusCode: error.statusCode,
                          field: error.field,
                          requestId: error.requestId,
                      }
                    : {}),
            };

            if (outcome === 'FAILED') {
                logger.error(
                    'ON_DEMAND_CHARGE_FAILED',
                    'Failed to charge the on-demand order',
                    context,
                    error,
                );
            } else {
                logger.warn(
                    'ON_DEMAND_CHARGE_REFUSED',
                    'The on-demand order was refused or its payment did not go through',
                    context,
                    error,
                );
            }

            return { error: outcome };
        } finally {
            isCharging.value = false;
        }
    };

    const reset = () => {
        chargedInvoice.value = undefined;
        chargeError.value = undefined;
    };

    return { isCharging, chargedInvoice, chargeError, charge, reset };
}
