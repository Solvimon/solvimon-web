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

const EMPTY_LEGAL_ENTITY_NAME = 'preview';
const EMPTY_COUNTRY = 'NL';

export function useCheckoutView({
    country,
    customerType,
    taxId,
    legalEntityName,
    subscriptionId,
    enabledPricingIds,
}: {
    country: Ref<string | undefined>;
    customerType: Ref<Customer['type'] | undefined>;
    taxId: Ref<string | undefined>;
    legalEntityName: Ref<string | undefined>;
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

            subscription.value = await getSubscription({
                id: subscriptionId,
                expanded: true,
            });

            const [invoicePreviewResponse, paymentMethodOptionsResponse] = await Promise.all([
                getInvoicePreview({
                    pricingPlanSubscriptionId: subscriptionId,
                    startAt: subscription.value?.pricing_plan_schedule_infos[0]?.start_at,
                    enabledPricingIds,
                    customer: {
                        type: customerType.value || 'INDIVIDUAL',
                        ...(customerType.value === 'INDIVIDUAL' && {
                            individual: {
                                residential_address: {
                                    country: country.value || EMPTY_COUNTRY,
                                },
                            },
                        }),
                        ...(customerType.value === 'ORGANIZATION' && {
                            organization: {
                                legal_name: legalEntityName.value || EMPTY_LEGAL_ENTITY_NAME,
                                registered_address: {
                                    country: country.value || EMPTY_COUNTRY,
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

            const trialSchedule = subscription.value?.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'TRIAL',
            );

            if (trialSchedule) {
                trialInvoicePreview.value = invoicePreviewResponse.first_invoice;

                if (trialSchedule.start_at && trialSchedule.end_at) {
                    trialPeriod.value = convertDateRangeToTimePeriod(
                        new Date(trialSchedule.start_at),
                        new Date(trialSchedule.end_at),
                    );
                }
            }

            const invoiceScheduleId = subscription.value?.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'DEFAULT',
            )?.id;

            const invoiceInfo = invoicePreviewResponse.invoice_infos.find(
                ({ pricing_plan_schedule_id }) => pricing_plan_schedule_id === invoiceScheduleId,
            );

            invoicePreview.value = invoiceInfo?.invoices[0];

            if (paymentMethodOptionsResponse) {
                paymentMethodOptions.value = paymentMethodOptionsResponse;
            }
        },
        watchValue: computed(() => `${country.value}${customerType.value}${taxId.value}`),
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
