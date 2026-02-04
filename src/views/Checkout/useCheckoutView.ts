import type {
    PricingPlanSubscriptionExpanded,
    Pricing,
    PricingPlanSubscription,
    CountryCode,
    Address,
    AuthorizePaymentPayload,
    Name,
    Amount,
    Invoice,
} from '@solvimon/types';
import { computed, onMounted, ref, watch } from 'vue';
import { taxId } from '@solvimon/ui/validators';
import { watchOnce } from '@vueuse/core';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useInvoicePreview } from '@/composables/useInvoicePreview';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import {
    getFirstPricingPlanScheduleOfType,
    getScheduleCustomizations,
} from '@/utils/pricingPlanSchedule';
import { withPreselectedEnabledPricings } from '@/utils/enabledPricings';

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
    const isPaid = ref<boolean>(false);
    const subscription = ref<PricingPlanSubscriptionExpanded>();

    const { getSubscription } = createSubscriptionsService();

    const invoicePreview = useInvoicePreview();

    const shouldLoadPaymentMethodOptions = computed(() => {
        return subscription.value && checkoutForm.form.value.country && amount.value;
    });

    const {
        paymentMethodOptions,
        loadPaymentMethodOptions,
        isPending: isPaymentMethodsPending,
    } = usePaymentMethodOptions();

    const loadInvoicePreview = () => {
        const payload = {
            subscription: subscription.value!,
            checkoutForm: checkoutForm.form.value,
            enabledPricingIds,
            promotionCode: checkoutForm.form.value.promotionCode,
        };

        if (checkoutForm.form.value.enabledPricingIds) {
            payload.enabledPricingIds = checkoutForm.form.value.enabledPricingIds;
        }

        return invoicePreview.loadInvoicePreview(payload);
    };

    /**
     * This function updates the invoice preview when the billing information changes
     */
    const updateInvoicePreviewOnBillingInformationChange = async (
        formState: Partial<CheckoutFormState>,
    ): Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }> => {
        const promotionCode = formState.promotionCode ?? checkoutForm.form.value.promotionCode;

        await invoicePreview.loadInvoicePreview({
            subscription: subscription.value!,
            checkoutForm: { ...checkoutForm.form.value, ...formState },
            enabledPricingIds,
            promotionCode,
        });

        return {
            trialInvoicePreview: invoicePreview.trialInvoicePreview.value!,
            invoicePreview: invoicePreview.invoicePreview.value!,
        };
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

            void loadInvoicePreview().catch(() => {
                // Ignore preview failures triggered by automatic form updates.
            });
        },
    });

    const loadSubscription = async () => {
        const response = await getSubscription({
            id: subscriptionId,
            expanded: true,
        });

        const subscriptionSchedule = getFirstPricingPlanScheduleOfType({
            pricingPlanScheduleInfos: response.pricing_plan_schedule_infos,
            type: 'DEFAULT',
        });

        subscription.value = response;
        checkoutForm.updateInitialState({
            ...checkoutForm.form.value,
            enabledPricingIds: withPreselectedEnabledPricings(response, enabledPricingIds),
            ...(subscriptionSchedule?.pricing_plan_schedule?.seats_values
                ? {
                      seatsValues: subscriptionSchedule?.pricing_plan_schedule?.seats_values.map(
                          ({ pricing_item_config_id, number }) => ({
                              pricing_item_config_id,
                              number,
                          }),
                      ),
                  }
                : {}),
        });
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

        const scheduleCustomizations = getScheduleCustomizations({
            enabledPricings: enabledPricingIds?.map((enabledPricingId) => ({
                pricing_id: enabledPricingId,
            })),
            seatsValues: checkoutForm.form.value.seatsValues,
            pricingPlanScheduleInfos: subscription.value?.pricing_plan_schedule_infos ?? [],
        });

        const promotionCode = checkoutForm.form.value.promotionCode;
        const scheduleCustomizationsWithPromotion =
            promotionCode && subscription.value
                ? (() => {
                      const customizations = scheduleCustomizations
                          ? [...scheduleCustomizations]
                          : [];
                      const defaultScheduleId =
                          customizations[0]?.pricing_plan_schedule_id ??
                          getFirstPricingPlanScheduleOfType({
                              pricingPlanScheduleInfos:
                                  subscription.value?.pricing_plan_schedule_infos ?? [],
                              type: 'DEFAULT',
                          })?.id;

                      if (!defaultScheduleId) {
                          return scheduleCustomizations;
                      }

                      const existingCustomization = customizations.find(
                          ({ pricing_plan_schedule_id }) =>
                              pricing_plan_schedule_id === defaultScheduleId,
                      );

                      if (existingCustomization) {
                          existingCustomization.promotion_codes = [promotionCode];
                      } else {
                          customizations.push({
                              pricing_plan_schedule_id: defaultScheduleId,
                              promotion_codes: [promotionCode],
                          });
                      }

                      return customizations;
                  })()
                : scheduleCustomizations;

        return {
            type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
            init_pricing_plan_subscription: {
                template_pricing_plan_subscription_id: subscriptionId,
                ...(scheduleCustomizationsWithPromotion && {
                    pricing_plan_schedule_customizations: scheduleCustomizationsWithPromotion,
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
                                  ...(checkoutForm.form.value.companyVatNumber &&
                                  taxId.$validator(checkoutForm.form.value.companyVatNumber, {}, {})
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
            if (!subscription.value || !country || !amountValue) {
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
        try {
            await loadInvoicePreview();
        } catch {
            // Ignore initial preview failures; caller-specific handlers can opt in.
        }
    });

    watchOnce(shouldLoadPaymentMethodOptions, (shouldLoad) => {
        if (shouldLoad) {
            void loadPaymentMethodOptions({
                subscriptionId: subscription.value!.id,
                country: checkoutForm.form.value.country!,
                amount: amount.value,
            });
        }
    });

    return {
        invoicePreview: invoicePreview.invoicePreview,
        trialInvoicePreview: invoicePreview.trialInvoicePreview,
        trialPeriod: invoicePreview.trialPeriod,
        updateInvoicePreviewOnBillingInformationChange,
        lastPreviewScheduleId: invoicePreview.lastPreviewScheduleId,
        paymentMethodOptions,
        isPaymentMethodsPending: isPaymentMethodsPending,
        isInvoicePreviewPending: invoicePreview.isPending,
        subscription,
        checkoutForm,
        authorizationContext,
        isPaid,
        amount,
    };
}
