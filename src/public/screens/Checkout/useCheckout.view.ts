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
} from '@solvimon/solvimon-types';
import { computed, onMounted, ref, watch } from 'vue';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useInvoicePreview } from '@/composables/useInvoicePreview';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import { usePaymentMethodOptions } from '@/composables/useCheckoutPaymentMethodOptions';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import {
    getFirstPricingPlanScheduleOfType,
    getScheduleCustomizations,
} from '@/utils/pricingPlanSchedule';
import { withPreselectedEnabledPricings } from '@/utils/enabledPricings';

const DEFAULT_TAX_IDENTIFIER_TYPE = 'GENERIC_TAX_ID';

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
        const enabledPricingIds =
            formState.enabledPricingIds ?? checkoutForm.form.value.enabledPricingIds;

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
        // Default to the smallest billing period from the plan (list is ordered).
        const defaultBillingPeriod =
            subscriptionSchedule?.pricing_plan_version?.billing_period_settings
                ?.billing_periods?.[0]?.period;

        subscription.value = {
            ...response,
            billing_period: defaultBillingPeriod ?? response.billing_period,
        };
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

        const scheduleInfo = getFirstPricingPlanScheduleOfType({
            pricingPlanScheduleInfos: subscription.value?.pricing_plan_schedule_infos ?? [],
            type: 'DEFAULT',
        });
        const pricingCurrencySettings =
            scheduleInfo?.pricing_plan_version?.pricing_currency_settings;
        const hasMultiplePricingCurrencies =
            (pricingCurrencySettings?.pricing_currencies?.length ?? 0) > 1;

        const billingPeriods =
            scheduleInfo?.pricing_plan_version?.billing_period_settings?.billing_periods ?? [];
        const hasMultipleBillingPeriods = billingPeriods.length > 1;

        const scheduleCustomizations = getScheduleCustomizations({
            enabledPricings: checkoutForm.form.value.enabledPricingIds?.map((enabledPricingId) => ({
                pricing_id: enabledPricingId,
            })),
            seatsValues: checkoutForm.form.value.seatsValues,
            pricingPlanScheduleInfos: subscription.value?.pricing_plan_schedule_infos ?? [],
            pricingCurrency: hasMultiplePricingCurrencies
                ? subscription.value?.billing_currency
                : undefined,
            billingPeriod: hasMultipleBillingPeriods
                ? subscription.value?.billing_period
                : undefined,
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
                          const baseCustomization = scheduleCustomizations?.[0];
                          customizations.push({
                              pricing_plan_schedule_id: defaultScheduleId,
                              ...(baseCustomization?.enabled_pricings && {
                                  enabled_pricings: baseCustomization.enabled_pricings,
                              }),
                              ...(baseCustomization?.seats_values && {
                                  seats_values: baseCustomization.seats_values,
                              }),
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
                                      ? {
                                            tax_ids: [
                                                {
                                                    id: checkoutForm.form.value.companyVatNumber,
                                                    type: DEFAULT_TAX_IDENTIFIER_TYPE,
                                                },
                                            ],
                                        }
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

            loadPaymentMethodOptions({
                subscriptionId: subscription.value.id,
                country,
                amount: amountValue,
            }).catch((err) => {
                // eslint-disable-next-line
                console.log(err);
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

    watch(
        shouldLoadPaymentMethodOptions,
        (shouldLoad) => {
            if (shouldLoad) {
                void loadPaymentMethodOptions({
                    subscriptionId: subscription.value!.id,
                    country: checkoutForm.form.value.country!,
                    amount: amount.value,
                });
            }
        },
        { once: true },
    );

    return {
        invoicePreview: invoicePreview.invoicePreview,
        invoicePreviewByBillingPeriod: invoicePreview.invoicePreviewByBillingPeriod,
        trialInvoicePreview: invoicePreview.trialInvoicePreview,
        trialPeriod: invoicePreview.trialPeriod,
        loadInvoicePreview,
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
