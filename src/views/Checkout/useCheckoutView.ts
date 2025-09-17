import type {
    Customer,
    Invoice,
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { computed, ref, type Ref } from 'vue';
import { useData } from '@/utils/useData';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createInvoicesService } from '@/services/invoices';

export function useCheckoutView({
    country,
    customerType,
    subscriptionId,
}: {
    country: Ref<string | undefined>;
    customerType: Ref<Customer['type'] | undefined>;
    subscriptionId: PricingPlanSubscription['id'];
}) {
    const invoicePreview = ref<Invoice>();
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>();

    const { getPaymentMethodOptions } = createPaymentMethodsService();
    const { getInvoicePreview } = createInvoicesService();

    const { isPending } = useData({
        getData: async (countryCode) => {
            if (!countryCode?.value) {
                return;
            }

            const [invoicePreviewResponse, paymentMethodOptionsResponse] = await Promise.all([
                getInvoicePreview({
                    pricingPlanSubscriptionId: subscriptionId,
                    customer: {
                        type: customerType.value || 'INDIVIDUAL',
                        ...(customerType.value === 'INDIVIDUAL'
                            ? {
                                  individual: {
                                      residential_address: {
                                          country: country.value || 'NL',
                                      },
                                  },
                              }
                            : {}),
                        ...(customerType.value === 'ORGANIZATION'
                            ? {
                                  organization: {
                                      legal_name: 'preview',
                                      registered_address: {
                                          country: country.value || 'NL',
                                      },
                                  },
                              }
                            : {}),
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

            invoicePreview.value = invoicePreviewResponse.invoice;

            if (paymentMethodOptionsResponse) {
                paymentMethodOptions.value = paymentMethodOptionsResponse;
            }
        },
        watchValue: computed(() => `${country.value}${customerType.value}`),
    });

    return { invoicePreview, paymentMethodOptions, isPending };
}
