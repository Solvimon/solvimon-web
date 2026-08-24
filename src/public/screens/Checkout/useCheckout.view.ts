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
import { useLogger } from '@/components/providers';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useInvoicePreview } from '@/composables/useInvoicePreview';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import {
    DEFAULT_TAX_IDENTIFIER_TYPE,
    toCustomer,
} from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import {
    getFirstPricingPlanScheduleOfType,
    getScheduleCustomizations,
} from '@/utils/pricingPlanSchedule';
import { withPreselectedEnabledPricings } from '@/utils/enabledPricings';
import { getQueryParam } from '@/utils/url';
import { PAYMENT_ACCEPTOR_ID_QUERY_STRING } from '@/utils/adyen';

const REDIRECT_FORM_STATE_KEY = 'solvimon_checkout_redirect_state';

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
    const logger = useLogger();

    const isPaid = ref<boolean>(false);
    const subscription = ref<PricingPlanSubscriptionExpanded>();

    const { getSubscription } = createSubscriptionsService();

    const invoicePreview = useInvoicePreview();

    const shouldLoadPaymentMethodOptions = computed(() => {
        return subscription.value && checkoutForm.form.value.country && amount.value;
    });

    const {
        paymentMethodOptions,
        get: loadPaymentMethodOptions,
        isPending: isPaymentMethodsPending,
    } = usePaymentMethodOptions();

    const loadInvoicePreview = () => {
        const formState = checkoutForm.form.value;

        return invoicePreview.loadInvoicePreview({
            subscription: subscription.value!,
            customer: toCustomer(formState),
            seatsValues: formState.seatsValues,
            enabledPricingIds: formState.enabledPricingIds ?? enabledPricingIds,
            promotionCode: formState.promotionCode,
        });
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

        const mergedState = { ...checkoutForm.form.value, ...formState };

        await invoicePreview.loadInvoicePreview({
            subscription: subscription.value!,
            customer: toCustomer(mergedState),
            seatsValues: mergedState.seatsValues,
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

    function saveFormStateForRedirect() {
        sessionStorage.setItem(REDIRECT_FORM_STATE_KEY, JSON.stringify(checkoutForm.form.value));
    }

    onMounted(async () => {
        const redirectStatus = getQueryParam('redirect_status');
        const hasPaymentAcceptorId = !!getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING);
        const hasClientSecret =
            !!getQueryParam('payment_intent_client_secret') ||
            !!getQueryParam('setup_intent_client_secret');
        const isSuccessfulRedirect =
            redirectStatus === 'succeeded' && hasPaymentAcceptorId && hasClientSecret;

        if (isSuccessfulRedirect) {
            isPaid.value = true;
        }

        const raw = sessionStorage.getItem(REDIRECT_FORM_STATE_KEY);
        let savedFormState: Partial<CheckoutFormState> | null = null;
        if (raw) {
            try {
                savedFormState = JSON.parse(raw);
            } catch {
                // Ignore malformed state
            }
        }

        // Apply early so the form shows the user's data immediately, before API calls complete.
        if (savedFormState) {
            checkoutForm.updateInitialState(savedFormState);
        }

        // Everything downstream waits on the subscription — the preview prices it, and the payment
        // method options need the amount that preview returns. So a failure here reads as "nothing
        // is loading" rather than as itself, and has to be reported where it happens.
        try {
            await loadSubscription();
        } catch (error) {
            logger.error(
                'SUBSCRIPTION_LOAD_FAILED',
                'Failed to load the subscription the checkout prices',
                {},
                error,
            );
            throw error;
        }

        try {
            await loadInvoicePreview();
        } catch {
            // Already reported by useInvoicePreview, and the form reloads the preview on every
            // change, so a failed first attempt is not fatal.
        }

        // Re-apply after loadSubscription resets enabledPricingIds/seatsValues to subscription
        // defaults, so the user's saved plan selections are preserved.
        if (savedFormState) {
            checkoutForm.updateInitialState(savedFormState);
            sessionStorage.removeItem(REDIRECT_FORM_STATE_KEY);
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
        saveFormStateForRedirect,
    };
}
