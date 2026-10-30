import type {
    PricingPlanSubscriptionExpanded,
    Pricing,
    PricingPlanSubscription,
    CountryCode,
    Address,
    Name,
    Amount,
    Invoice,
    ConfiguredMeterValue,
    BillingPeriod,
} from '@solvimon/solvimon-types';
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { email } from '@vuelidate/validators';
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import { toRestorableForm } from './savedFormState';
import type { PriceSettlement } from './Checkout.source.types';
import { useLogger } from '@/components/providers';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useInvoicePreview } from '@/composables/useInvoicePreview';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import {
    DEFAULT_TAX_IDENTIFIER_TYPE,
    isVatNumberShown,
    readAddress,
    toPreviewCustomer,
    toShippingAddressDetails,
} from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import type { CheckoutAuthorizationContext } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import {
    getFirstPricingPlanScheduleOfType,
    getScheduleCustomizations,
} from '@/utils/pricingPlanSchedule';
import { withPreselectedEnabledPricings } from '@/utils/enabledPricings';
import { splitInvoiceByRecurrence } from '@/utils/invoice';
import { getInitialMeterValues } from '@/utils/meterValues';
import { hasPaymentRedirectReturn } from '@/utils/paymentRedirect';
import { randomUuid } from '@/utils/randomUuid';

/** Unscoped and without a timestamp; only read to be removed. */
const LEGACY_REDIRECT_FORM_STATE_KEY = 'solvimon_checkout_redirect_state';
const REDIRECT_FORM_STATE_KEY_PREFIX = 'solvimon_checkout_redirect_state:';
const REDIRECT_FORM_STATE_MAX_AGE_MS = 60 * 60 * 1000;

type SavedFormState = { savedAt: number; form: unknown };

function isSavedFormState(value: unknown): value is SavedFormState {
    return (
        typeof value === 'object' &&
        value !== null &&
        'savedAt' in value &&
        typeof value.savedAt === 'number' &&
        'form' in value
    );
}

/**
 * Saved seats or units stand only if every one is a config the order starts the form with;
 * otherwise the order's own values stay, as the editor shows nothing for a config it does not know.
 * They are laid over the order's list, so a config the saved list lacks keeps its row, and none
 * goes below the order's quantity, which is as low as the editor lets the customer go.
 */
function restoreOnOrder(
    saved: ConfiguredMeterValue[] | undefined,
    orderValues: ConfiguredMeterValue[] | undefined,
): ConfiguredMeterValue[] | undefined {
    if (!saved || !orderValues) return undefined;

    const savedNumbers = new Map(
        saved.map(({ pricing_item_config_id, number }) => [pricing_item_config_id, number]),
    );
    const orderConfigIds = new Set(
        orderValues.map(({ pricing_item_config_id }) => pricing_item_config_id),
    );
    if ([...savedNumbers.keys()].some((id) => !orderConfigIds.has(id))) return undefined;

    return orderValues.map((orderValue) => {
        const savedNumber = Number(savedNumbers.get(orderValue.pricing_item_config_id));
        const orderNumber = Number(orderValue.number);
        return savedNumber > orderNumber
            ? { ...orderValue, number: String(savedNumber) }
            : orderValue;
    });
}

/** How long a payment waits for the price before it is held back instead. */
export const PRICE_SETTLE_TIMEOUT_MS = 10_000;

export function useCheckoutView({
    initialCountry,
    initialEmail,
    subscriptionId,
    enabledPricingIds,
    isShippingAddressRequired,
}: {
    initialCountry: CountryCode | undefined;
    initialEmail: string | undefined;
    subscriptionId: PricingPlanSubscription['id'];
    enabledPricingIds?: Pricing['id'][];
    isShippingAddressRequired?: boolean;
}) {
    const logger = useLogger();

    /**
     * What the host configured is validated here, inside the provider tree, because rejecting a
     * value has to be reported: a logger resolved above `LoggerProvider` is the no-op fallback, and
     * anything it is told never reaches the sink the host passed.
     */
    const validatedCountry = (() => {
        if (!initialCountry) return undefined;
        if (isValidCountryCode(initialCountry)) return initialCountry;

        logger.error('INVALID_COUNTRY_CODE', `invalid country code provided: "${initialCountry}"`);
        return undefined;
    })();

    const validatedEmail = (() => {
        if (!initialEmail) return undefined;
        // The same check the email field makes, and the address is personal data: not logged.
        if (email.$validator(initialEmail, {}, {}) === true) return initialEmail;

        logger.error('INVALID_EMAIL', 'invalid email provided');
        return undefined;
    })();

    const isPaid = ref<boolean>(false);
    const subscription = ref<PricingPlanSubscriptionExpanded>();
    // Kept apart from the form's initial state, which a restored form overwrites with the
    // customer's own choice: the editor's steppers may not go below the order's quantities.
    const orderMeterValues = shallowRef<{
        seatsValues?: ConfiguredMeterValue[];
        unitsValues?: ConfiguredMeterValue[];
    }>({});

    const { getSubscription } = createSubscriptionsService();

    const invoicePreview = useInvoicePreview();

    const shouldLoadPaymentMethodOptions = computed(() => {
        return subscription.value && checkoutForm.form.value.country && amount.value;
    });

    const {
        paymentMethodOptions,
        get: loadPaymentMethodOptions,
        isPending: isPaymentMethodsPending,
        error: paymentMethodOptionsError,
    } = usePaymentMethodOptions();

    const loadPaymentMethodOptionsFor = async (country: CountryCode, amountValue: Amount) => {
        try {
            await loadPaymentMethodOptions({
                subscriptionId: subscription.value!.id,
                country,
                amount: amountValue,
            });
        } catch (error) {
            logger.error(
                'PAYMENT_METHOD_OPTIONS_LOAD_FAILED',
                'Failed to load the payment methods that can be offered',
                { flow: 'CHECKOUT' },
                error,
            );
        }
    };

    const hasPaymentMethodOptionsError = computed(() => paymentMethodOptionsError.value !== null);

    const loadPaymentMethodOptionsIfReady = () => {
        const { country } = checkoutForm.form.value;

        if (!subscription.value || !country || !amount.value) {
            return;
        }

        void loadPaymentMethodOptionsFor(country, amount.value);
    };

    const previewAddress = () => ({
        isShipped: !!isShippingAddressRequired,
        format: checkoutForm.shippingAddressFormat.value,
    });

    const loadInvoicePreview = () => {
        const formState = checkoutForm.form.value;

        return invoicePreview.loadInvoicePreview({
            subscription: subscription.value!,
            customer: toPreviewCustomer(formState, previewAddress()),
            seatsValues: formState.seatsValues,
            unitsValues: formState.unitsValues,
            enabledPricingIds: formState.enabledPricingIds ?? enabledPricingIds,
            promotionCode: formState.promotionCode,
        });
    };

    const changeBillingPeriod = (billingPeriod: BillingPeriod) => {
        if (!subscription.value) {
            return;
        }

        subscription.value = { ...subscription.value, billing_period: billingPeriod };

        // Already logged as INVOICE_PREVIEW_FAILED, and the next change loads it again.
        loadInvoicePreview().catch(() => {});
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
            customer: toPreviewCustomer(mergedState, previewAddress()),
            seatsValues: mergedState.seatsValues,
            unitsValues: mergedState.unitsValues,
            enabledPricingIds,
            promotionCode,
        });

        return {
            trialInvoicePreview: invoicePreview.trialInvoicePreview.value!,
            invoicePreview: invoicePreview.invoicePreview.value!,
        };
    };

    const checkoutForm = useCheckoutForm({
        isShippingAddressRequired,
        initialState: {
            country: validatedCountry,
            email: validatedEmail,
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

        const seatsValues = getInitialMeterValues('seats', subscriptionSchedule);
        const unitsValues = getInitialMeterValues('units', subscriptionSchedule);
        orderMeterValues.value = { seatsValues, unitsValues };

        checkoutForm.updateInitialState({
            ...checkoutForm.form.value,
            enabledPricingIds: withPreselectedEnabledPricings(response, enabledPricingIds),
            ...(seatsValues ? { seatsValues } : {}),
            ...(unitsValues ? { unitsValues } : {}),
        });
    };

    // The checkout always creates a new customer, so a fresh reference cannot collide.
    let shippingAddressReference: string | undefined;
    const getShippingAddressReference = (): string => (shippingAddressReference ??= randomUuid());

    const authorizationContext = computed<CheckoutAuthorizationContext>(() => {
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
        const billingAddress = isShippingAddressRequired
            ? readAddress(checkoutForm.form.value, 'BILLING')
            : address;

        const scheduleInfo = getFirstPricingPlanScheduleOfType({
            pricingPlanScheduleInfos: subscription.value?.pricing_plan_schedule_infos ?? [],
            type: 'DEFAULT',
        });
        const pricingCurrencySettings =
            scheduleInfo?.pricing_plan_version?.pricing_currency_settings;
        const hasMultiplePricingCurrencies =
            (pricingCurrencySettings?.pricing_currencies?.length ?? 0) > 1;

        // The API rejects a schedule without a billing period when the version has billing period
        // settings, even when they offer only one.
        const hasBillingPeriodSettings = Boolean(
            scheduleInfo?.pricing_plan_version?.billing_period_settings?.billing_periods?.length,
        );

        const scheduleCustomizations = getScheduleCustomizations({
            enabledPricings: checkoutForm.form.value.enabledPricingIds?.map((enabledPricingId) => ({
                pricing_id: enabledPricingId,
            })),
            seatsValues: checkoutForm.form.value.seatsValues,
            unitsValues: checkoutForm.form.value.unitsValues,
            pricingPlanScheduleInfos: subscription.value?.pricing_plan_schedule_infos ?? [],
            pricingCurrency: hasMultiplePricingCurrencies
                ? subscription.value?.billing_currency
                : undefined,
            billingPeriod: hasBillingPeriodSettings
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
                              ...(baseCustomization?.units && {
                                  units: baseCustomization.units,
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
                ...(isShippingAddressRequired && {
                    shipping_address_details: toShippingAddressDetails(
                        checkoutForm.form.value,
                        getShippingAddressReference(),
                        checkoutForm.shippingAddressFormat.value,
                    ),
                }),
                customer_details: {
                    email: checkoutForm.form.value.email ?? '',
                    type: checkoutForm.form.value.type,
                    ...(checkoutForm.form.value.type === 'INDIVIDUAL'
                        ? {
                              individual: {
                                  residential_address: billingAddress,
                                  ...(name ? { name } : {}),
                              },
                          }
                        : {
                              organization: {
                                  registered_address: billingAddress,
                                  ...{ legal_name: checkoutForm.form.value.companyLegalName ?? '' },
                                  ...(checkoutForm.form.value.companyVatNumber &&
                                  isVatNumberShown(checkoutForm.form.value) &&
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

    const invoiceRecurrence = computed(() =>
        invoicePreview.invoicePreview.value
            ? splitInvoiceByRecurrence(invoicePreview.invoicePreview.value)
            : undefined,
    );

    const hasOneOffCharges = computed(() => invoiceRecurrence.value?.hasOneOff ?? false);

    /**
     * The only place a screen or a payment sheet should ask what the subscription renews at: should
     * the API come to return the recurring invoice itself, this is what changes.
     *
     * `undefined` where the split cannot account for part of the invoice, rather than a number the
     * customer would be told — and asked to authorize — as the price of every period to come.
     */
    const recurringAmount = computed<Amount | undefined>(() => {
        const split = invoiceRecurrence.value;

        if (!split) {
            return undefined;
        }

        if (!split.hasOneOff) {
            return invoicePreview.invoicePreview.value?.invoice_amount_including_tax;
        }

        return split.hasUnattributed ? undefined : split.recurring.includingTax;
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

            void loadPaymentMethodOptionsFor(country, amountValue);
        },
    );

    const redirectFormStateKey = `${REDIRECT_FORM_STATE_KEY_PREFIX}${subscriptionId}`;
    // Read before anything mounts: the payment form takes the redirect parameters out of the URL.
    const isRedirectReturn = hasPaymentRedirectReturn();

    /** Kept only for the redirect a payment may make; a payment that ends here clears it. */
    function saveFormStateForRedirect() {
        const saved: SavedFormState = { savedAt: Date.now(), form: checkoutForm.form.value };
        try {
            sessionStorage.setItem(redirectFormStateKey, JSON.stringify(saved));
        } catch (error) {
            logger.warn(
                'CHECKOUT_FORM_STATE_NOT_SAVED',
                'Could not keep the checkout form for a redirect return',
                {},
                error,
            );
        }
    }

    function clearSavedFormState() {
        try {
            sessionStorage.removeItem(redirectFormStateKey);
            sessionStorage.removeItem(LEGACY_REDIRECT_FORM_STATE_KEY);
        } catch {
            // Storage that cannot be read holds nothing to clear.
        }
    }

    /** The form as it was before the redirect this page returns from, at most once. */
    function takeSavedFormState(): Partial<CheckoutFormState> | undefined {
        let raw: string | null = null;
        try {
            raw = sessionStorage.getItem(redirectFormStateKey);
        } catch {
            return undefined;
        }
        clearSavedFormState();

        if (!raw || !isRedirectReturn) return undefined;

        let saved: unknown;
        try {
            saved = JSON.parse(raw);
        } catch {
            return undefined;
        }

        if (!isSavedFormState(saved)) return undefined;

        const age = Date.now() - saved.savedAt;
        if (age < 0 || age > REDIRECT_FORM_STATE_MAX_AGE_MS) return undefined;

        // The host's email is shown read-only, so it stands over whatever was saved.
        const form = toRestorableForm(saved.form);
        if (validatedEmail) delete form.email;
        return Object.keys(form).length ? form : undefined;
    }

    // A redirect return is not marked paid here: the payment form confirms it with the gateway and
    // goes through the same success handler as any other payment.
    onMounted(async () => {
        const savedFormState = takeSavedFormState();

        // Apply early so the form shows the user's data immediately, before API calls complete.
        if (savedFormState) {
            checkoutForm.updateInitialState(savedFormState);
        }

        // Everything downstream waits on the subscription — the preview prices it, and the payment
        // method options need the amount that preview returns. So a failure here reads as "nothing
        // is loading" rather than as itself, and has to be reported where it happens. Reported, it
        // is handled: rethrowing would report it again as unhandled.
        try {
            await loadSubscription();
        } catch (error) {
            logger.error(
                'SUBSCRIPTION_LOAD_FAILED',
                'Failed to load the subscription the checkout prices',
                {},
                error,
            );
            return;
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
            const { seatsValues, unitsValues, ...rest } = savedFormState;
            const restoredSeats = restoreOnOrder(seatsValues, orderMeterValues.value.seatsValues);
            const restoredUnits = restoreOnOrder(unitsValues, orderMeterValues.value.unitsValues);
            checkoutForm.updateInitialState({
                ...rest,
                ...(restoredSeats ? { seatsValues: restoredSeats } : {}),
                ...(restoredUnits ? { unitsValues: restoredUnits } : {}),
            });
        }
    });

    /**
     * Whether the price on screen is the price of the form as it is. The amount authorized comes
     * from the preview, and the server takes it as given, so a payment waits on this first: a
     * change the debounce still holds back is asked for now, and a failed preview is asked again.
     * The wait follows the latest preview, and gives up after a while rather than hold Pay.
     */
    const settleInvoicePreview = async (): Promise<PriceSettlement> => {
        if (!subscription.value) return 'FAILED';

        checkoutForm.flushPreviewChange();
        if (invoicePreview.isFailed.value) {
            void loadInvoicePreview().catch(() => {
                // Settled below.
            });
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), PRICE_SETTLE_TIMEOUT_MS);
        });
        try {
            const isLoaded = await Promise.race([
                invoicePreview.whenLoaded().then(() => true),
                timedOut,
            ]);
            if (!isLoaded) return 'FAILED';
        } catch {
            return 'FAILED';
        } finally {
            clearTimeout(timer);
        }
        // The payment form reads the amount from its props, which follow on the next render.
        await nextTick();

        return checkoutForm.isPreviewStale.value || invoicePreview.isPending.value
            ? 'CHANGED'
            : 'SETTLED';
    };

    watch(
        shouldLoadPaymentMethodOptions,
        (shouldLoad) => {
            if (shouldLoad) {
                loadPaymentMethodOptionsIfReady();
            }
        },
        { once: true },
    );

    return {
        /** What the host configured, once anything unusable has been dropped and reported. */
        validatedEmail,
        validatedCountry,
        invoicePreview: invoicePreview.invoicePreview,
        invoicePreviewByBillingPeriod: invoicePreview.invoicePreviewByBillingPeriod,
        trialInvoicePreview: invoicePreview.trialInvoicePreview,
        trialPeriod: invoicePreview.trialPeriod,
        loadInvoicePreview,
        changeBillingPeriod,
        updateInvoicePreviewOnBillingInformationChange,
        lastPreviewScheduleId: invoicePreview.lastPreviewScheduleId,
        paymentMethodOptions,
        hasPaymentMethodOptionsError,
        retryPaymentMethodOptions: loadPaymentMethodOptionsIfReady,
        isPaymentMethodsPending: isPaymentMethodsPending,
        isInvoicePreviewPending: invoicePreview.isPending,
        isInvoicePreviewStale: checkoutForm.isPreviewStale,
        settleInvoicePreview,
        subscription,
        orderMeterValues,
        checkoutForm,
        authorizationContext,
        isPaid,
        amount,
        recurringAmount,
        hasOneOffCharges,
        saveFormStateForRedirect,
        clearSavedFormState,
    };
}
