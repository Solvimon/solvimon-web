import {
    type PricingPlanSubscriptionExpanded,
    type Pricing,
    type PricingPlanSubscription,
    type CountryCode,
    type Address,
    type AuthorizePaymentPayload,
    type Name,
    type Amount,
} from '@solvimon/types';
import { computed, onMounted, ref, watch } from 'vue';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useInvoicePreview } from '@/composables/useInvoicePreview';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';

export function useCheckoutView({
    initialCountry,
    initialEmail,
    subscriptionId,
    enabledPricingIds,
}: {
    initialCountry: CountryCode | undefined;
    initialEmail: string | undefined;
    subscriptionId: PricingPlanSubscription['id'];
    enabledPricingIds?: Pricing['id'][];
}) {
    const isPaid = ref(false);
    const subscription = ref<PricingPlanSubscriptionExpanded>();

    const { getSubscription } = createSubscriptionsService();

    const invoicePreview = useInvoicePreview();

    const { paymentMethodOptions, loadPaymentMethodOptions } = usePaymentMethodOptions();

    const loadInvoicePreview = async () => {
        await invoicePreview.loadInvoicePreview({
            subscription: subscription.value!,
            subscriptionStartAt: subscription.value!.pricing_plan_schedule_infos[0]!.start_at!,
            checkoutForm: checkoutForm.form.value,
            enabledPricingIds,
        });
    };

    const checkoutForm = useCheckoutForm({
        initialState: {
            country: initialCountry,
            email: initialEmail,
        },
        onRequiredFieldChange: () => {
            if (!subscription.value) {
                return;
            }

            void loadInvoicePreview();
        },
    });

    const loadSubscription = async () => {
        const response = await getSubscription({
            id: subscriptionId,
            expanded: true,
        });
        subscription.value = response;
    };

    const authorizationContext = computed<AuthorizePaymentPayload['context']>(() => {
        const name: Name =
            checkoutForm.form.value.firstName ||
            checkoutForm.form.value.infix ||
            checkoutForm.form.value.lastName
                ? {
                      ...(checkoutForm.form.value.firstName
                          ? { first_name: checkoutForm.form.value.firstName }
                          : {}),
                      ...(checkoutForm.form.value.infix
                          ? { infix: checkoutForm.form.value.infix }
                          : {}),
                      ...(checkoutForm.form.value.lastName
                          ? { last_name: checkoutForm.form.value.lastName }
                          : {}),
                  }
                : {};

        const address: Address = {
            ...(checkoutForm.form.value.addressLine1 && {
                line1: checkoutForm.form.value.addressLine1,
            }),
            ...(checkoutForm.form.value.addressLine2 && {
                line2: checkoutForm.form.value.addressLine2,
            }),
            ...(checkoutForm.form.value.city && { city: checkoutForm.form.value.city }),
            ...(checkoutForm.form.value.postalCode && {
                postal_code: checkoutForm.form.value.postalCode,
            }),
            ...(checkoutForm.form.value.state && { state: checkoutForm.form.value.state }),
            ...{ country: checkoutForm.form.value.country ?? '' },
        };

        return {
            type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
            init_pricing_plan_subscription: {
                template_pricing_plan_subscription_id: subscriptionId,
                ...(enabledPricingIds && {
                    enabled_pricings: enabledPricingIds.map((enabledPricingId) => ({
                        pricing_id: enabledPricingId,
                    })),
                }),
                customer_details: {
                    email: checkoutForm.form.value.email ?? '',
                    type: checkoutForm.form.value.type,
                    ...(checkoutForm.form.value.type === 'INDIVIDUAL'
                        ? {
                              individual: {
                                  residential_address: address,
                                  ...(name ? { name } : {}),
                              },
                          }
                        : {
                              organization: {
                                  registered_address: address,
                                  ...{ legal_name: checkoutForm.form.value.companyLegalName ?? '' },
                                  ...(checkoutForm.form.value.companyVatNumber
                                      ? { tax_id: checkoutForm.form.value.companyVatNumber }
                                      : {}),
                              },
                          }),
                },
            },
        };
    });

    const amount = computed(() => {
        return (
            invoicePreview.trialInvoicePreview.value?.invoice_amount_including_tax ??
            invoicePreview.invoicePreview.value?.invoice_amount_including_tax
        );
    });

    /**
     * Reload the payment method options whenever the country or amount changes.
     */
    watch(
        [() => checkoutForm.form.value.country, amount],
        ([country, amountValue]: [CountryCode | undefined, Amount | undefined]) => {
            if (!subscription.value || !country) {
                return;
            }

            void loadPaymentMethodOptions({
                subscriptionId: subscription.value.id,
                country,
                amount: amountValue,
            });
        },
    );

    onMounted(async () => {
        await loadSubscription();
    });

    /**
     * Only do this once, when the subscription is loaded.
     */
    const stopWatchSubscription = watch(
        () => subscription.value,
        (subscription) => {
            const country = checkoutForm.form.value.country || initialCountry;

            if (!subscription || !country) {
                return;
            }

            void loadPaymentMethodOptions({ subscriptionId, country, amount: amount.value });
            void loadInvoicePreview();

            stopWatchSubscription();
        },
    );

    return {
        invoicePreview: invoicePreview.invoicePreview,
        trialInvoicePreview: invoicePreview.trialInvoicePreview,
        trialPeriod: invoicePreview.trialPeriod,
        paymentMethodOptions,
        isPending: false,
        subscription,
        checkoutForm,
        authorizationContext,
        isPaid,
        amount,
    };
}
