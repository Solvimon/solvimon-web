import {
    type PricingPlanSubscriptionExpanded,
    type Customer,
    type Invoice,
    type PaymentMethodOptionsResponse,
    type Pricing,
    type PricingPlanSubscription,
    type TimePeriod,
} from '@solvimon/types';
import { computed, ref, type Ref } from 'vue';
import { convertDateRangeToTimePeriod } from '@solvimon/ui';
import { useData } from '@/utils/useData';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createInvoicesService } from '@/services/invoices';
import { createSubscriptionsService } from '@/services/subscriptions';

export function useCheckoutView({
    country,
    customerType,
    subscriptionId,
    enabledPricingIds,
}: {
    country: Ref<string | undefined>;
    customerType: Ref<Customer['type'] | undefined>;
    subscriptionId: PricingPlanSubscription['id'];
    enabledPricingIds?: Pricing['id'][];
}) {
    const subscription = ref<PricingPlanSubscriptionExpanded>();
    const trialPeriod = ref<TimePeriod>();
    const trialInvoicePreview = ref<Invoice>();
    const invoicePreview = ref<Invoice>();
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>();

    const { getPaymentMethodOptions } = createPaymentMethodsService();
    const { getInvoicePreview } = createInvoicesService();
    const { getSubscription } = createSubscriptionsService();

    const { isPending } = useData({
        getData: async (countryCode) => {
            if (!countryCode?.value) {
                return;
            }

            const [subscriptionResponse, invoicePreviewResponse, paymentMethodOptionsResponse] =
                await Promise.all([
                    getSubscription({
                        id: subscriptionId,
                        expanded: true,
                    }),
                    getInvoicePreview({
                        pricingPlanSubscriptionId: subscriptionId,
                        enabledPricingIds,
                        customer: {
                            type: customerType.value || 'INDIVIDUAL',
                            ...(customerType.value === 'INDIVIDUAL' && {
                                individual: {
                                    residential_address: {
                                        country: country.value || 'NL',
                                    },
                                },
                            }),
                            ...(customerType.value === 'ORGANIZATION' && {
                                organization: {
                                    legal_name: 'preview',
                                    registered_address: {
                                        country: country.value || 'NL',
                                    },
                                },
                            }),
                        },
                    }),
                    ...(country.value
                        ? [
                              getPaymentMethodOptions({
                                  subscriptionId,
                                  country: country.value,
                              }),
                          ]
                        : []),
                ]);

            subscription.value = subscriptionResponse;

            const trialSchedule = subscriptionResponse.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'TRIAL'
            );

            if (trialSchedule) {
                trialInvoicePreview.value = invoicePreviewResponse.first_invoice;

                if (trialSchedule.start_at && trialSchedule.end_at) {
                    trialPeriod.value = convertDateRangeToTimePeriod(
                        new Date(trialSchedule.start_at),
                        new Date(trialSchedule.end_at)
                    );
                }
            }

            const invoiceScheduleId = subscriptionResponse.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'DEFAULT'
            )?.id;

            const invoiceInfo = invoicePreviewResponse.invoice_infos.find(
                ({ pricing_plan_schedule_id }) => pricing_plan_schedule_id === invoiceScheduleId
            );

            invoicePreview.value = invoiceInfo?.invoices[0];

            if (paymentMethodOptionsResponse) {
                paymentMethodOptions.value = paymentMethodOptionsResponse;
            }
        },
        watchValue: computed(() => `${country.value}${customerType.value}`),
    });

    return {
        invoicePreview,
        trialInvoicePreview,
        paymentMethodOptions,
        isPending,
        trialPeriod,
        subscription,
    };
}
