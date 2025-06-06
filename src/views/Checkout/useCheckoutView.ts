import type {
    Invoice,
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { ref, type Ref } from 'vue';
import { useData } from '@/utils/useData';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createInvoicesService } from '@/services/invoices';

export function useCheckoutView({
    country,
    subscriptionId,
}: {
    country: Ref<string | undefined>;
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
                        type: 'INDIVIDUAL',
                        individual: {
                            residential_address: {
                                country: countryCode.value,
                            },
                        },
                    },
                }),
                getPaymentMethodOptions({
                    subscriptionId,
                    country: countryCode.value,
                }),
            ]);

            invoicePreview.value = invoicePreviewResponse.invoice;
            paymentMethodOptions.value = paymentMethodOptionsResponse;
        },
        watchValue: country,
    });

    return { invoicePreview, paymentMethodOptions, isPending };
}
