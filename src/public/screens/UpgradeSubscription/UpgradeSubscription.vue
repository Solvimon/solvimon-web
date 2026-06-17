<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
    Typography,
    useIntl,
    Button,
    ErrorNotification,
    getCustomerCountry,
} from '@solvimon/solvimon-ui';
import type { Amount, Invoice, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { UpgradeSubscriptionProps } from './UpgradeSubscription.types';
import type {
    OnDemandPricing,
    OnDemandPricingCategory,
} from '@/components/subscriptions/UpgradeSubscription/UpgradeSubscription.types';
import UpgradeOrderSummary from '@/components/subscriptions/UpgradeOrderSummary.vue';
import OnDemandPricingList from '@/components/subscriptions/OnDemandPricingList.vue';
import { ContentWithAsideLayout } from '@/layouts';
import { usePortal, useLogger, useActionDispatchProvider } from '@/components/providers';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import { createSubscriptionsService } from '@/services/subscriptions';
import { createCustomerService } from '@/services/customer';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createInvoicesService } from '@/services/invoices';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import type { ChargeOnDemandAuthorizationContext } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';
import type { Error as PaymentError } from '@/types/errors';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';
import { useViewport } from '@/composables/useViewport';

const props = defineProps<UpgradeSubscriptionProps>();
const { $t } = useIntl();
const { getSubscription } = createSubscriptionsService();
const { getCustomer } = createCustomerService();
const { getOnDemandPricingItems } = createPricingPlanSchedulesService();
const { getPaymentMethodOptions } = createPaymentMethodsService();
const { previewChargeOnDemandPricingItems } = createInvoicesService();
const portal = usePortal();
const logger = useLogger();
const { dispatchAction } = useActionDispatchProvider();
const { isMobileViewport } = useViewport();

const customerId = computed(() => portal.value.customer_id);
const DEFAULT_PAYMENT_FORM_AMOUNT: Amount = {
    currency: 'EUR',
    quantity: '0',
};

const selectedPricingIds = ref<string[]>([]);
const isPurchased = ref(false);
const categories = ref<OnDemandPricingCategory[]>([]);
const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);
const isLoadingItems = ref(false);
const isPreviewPending = ref(false);
const isPurchasePending = ref(false);
const previewPendingPricingId = ref<string | undefined>(undefined);
const loadError = ref<string | undefined>(undefined);
const paymentIntegrationFormRef = ref();
const activeScheduleId = ref<string | undefined>(undefined);
const previewInvoice = ref<Invoice | undefined>(undefined);
const countryCode = ref<string | undefined>(undefined);
const hasSelectedPaymentMethod = ref(false);

type ExpandedPricingCategory = OnDemandPricingCategory;

const getActiveSchedule = async () => {
    const subscription = await getSubscription({
        id: props.configuration.subscriptionId,
        expanded: true,
    });
    const schedules = subscription.pricing_plan_schedule_infos ?? [];
    const sortedSchedules = [...schedules].sort(
        (a, b) => Date.parse(b.start_at) - Date.parse(a.start_at),
    );
    const now = Date.now();
    const activeSchedule = sortedSchedules.find((schedule) => {
        const scheduleType = schedule.pricing_plan_schedule?.type ?? schedule.type;
        const startAt = Date.parse(schedule.start_at);
        const endAt = schedule.end_at ? Date.parse(schedule.end_at) : undefined;
        const hasStarted = Number.isFinite(startAt) && startAt <= now;
        const hasNotEnded = endAt === undefined || !Number.isFinite(endAt) || endAt > now;

        return scheduleType === 'DEFAULT' && hasStarted && hasNotEnded;
    });

    if (!activeSchedule?.id) {
        throw new Error('No pricing plan schedule found for subscription');
    }

    return activeSchedule;
};

const findSourceCategory = (
    category: OnDemandPricingCategory,
    sourceCategories: ExpandedPricingCategory[],
) =>
    sourceCategories.find(
        (sourceCategory) =>
            sourceCategory.product_category_id === category.product_category_id ||
            sourceCategory.id === category.id,
    );

const findSourcePricing = (pricing: OnDemandPricing, sourcePricings: OnDemandPricing[] = []) =>
    sourcePricings.find((sourcePricing) => sourcePricing.id === pricing.id);

// Each pricing can have multiple items (e.g. different units). We turn each item
// into its own selectable row. The on-demand items response has no product names,
// but we already have the full pricing plan version from the subscription call, so we use that.
const normalizePricingRows = (
    pricing: OnDemandPricing,
    sourcePricing?: OnDemandPricing,
): OnDemandPricing[] =>
    (pricing.items ?? []).map((item) => {
        const sourceItem = sourcePricing?.items?.find((candidate) => candidate.id === item.id);
        const productItems = item.product_items ?? sourceItem?.product_items;

        return {
            ...pricing,
            id: item.id,
            name:
                item.product_items?.[0]?.name ??
                sourceItem?.product_items?.[0]?.name ??
                pricing.name ??
                sourcePricing?.name ??
                sourcePricing?.products?.[0]?.name,
            products: pricing.products ?? sourcePricing?.products,
            items: [
                {
                    ...item,
                    product_items: productItems,
                },
            ],
        };
    });

// Same deal as normalizePricingRows: category names aren't in the on-demand items
// response, so we use the pricing plan version we already fetched.
const normalizeOnDemandCategories = (
    categories: OnDemandPricingCategory[],
    sourceCategories: ExpandedPricingCategory[],
): OnDemandPricingCategory[] =>
    categories.map((category) => {
        const sourceCategory = findSourceCategory(category, sourceCategories);

        return {
            ...category,
            name: category.name ?? sourceCategory?.name,
            product_category: category.product_category ?? sourceCategory?.product_category,
            pricings: (category.pricings ?? []).flatMap((pricing) =>
                normalizePricingRows(pricing, findSourcePricing(pricing, sourceCategory?.pricings)),
            ),
            pricing_groups: (category.pricing_groups ?? []).map((group) => {
                const sourceGroup = sourceCategory?.pricing_groups?.find(
                    (candidate) => candidate.id === group.id,
                );

                return {
                    ...group,
                    name: group.name ?? sourceGroup?.name,
                    pricings: (group.pricings ?? []).flatMap((pricing) =>
                        normalizePricingRows(
                            pricing,
                            findSourcePricing(pricing, sourceGroup?.pricings),
                        ),
                    ),
                };
            }),
        };
    });

const loadOnDemandPricingItems = async () => {
    isLoadingItems.value = true;
    loadError.value = undefined;
    try {
        const activeSchedule = await getActiveSchedule();
        activeScheduleId.value = activeSchedule.id;
        const [itemsResponse, optionsResponse, customer] = await Promise.all([
            getOnDemandPricingItems({ scheduleId: activeScheduleId.value }),
            getPaymentMethodOptions({ customerId: customerId.value }),
            getCustomer(customerId.value),
        ]);

        categories.value = normalizeOnDemandCategories(
            itemsResponse.pricing_categories ?? [],
            activeSchedule.pricing_plan_version?.pricing_categories ?? [],
        );
        paymentMethodOptions.value = optionsResponse;
        countryCode.value = getCustomerCountry(customer);
    } catch (error) {
        logger.error(
            'INITIAL_DATA_LOAD_FAILED',
            'Failed to load on-demand pricing items',
            {},
            error,
        );
        loadError.value = $t({
            defaultMessage: 'Unable to load items. Please try again later.',
            id: 'upgrade_subscription.load_error',
            description:
                'Error message shown when the one-off items cannot be loaded on the upgrade subscription page',
        });
    } finally {
        isLoadingItems.value = false;
    }
};

onMounted(() => {
    void loadOnDemandPricingItems();
});

const allOnDemandPricings = computed<OnDemandPricing[]>(() =>
    categories.value.flatMap((cat) => [
        ...(cat.pricings ?? []),
        ...(cat.pricing_groups ?? []).flatMap((g) => g.pricings ?? []),
    ]),
);

const selectedPricings = computed<OnDemandPricing[]>(() =>
    allOnDemandPricings.value.filter((p) => selectedPricingIds.value.includes(p.id)),
);

const selectedPricingItemIds = computed(() =>
    selectedPricings.value
        .flatMap((pricing) => pricing.items ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
);

const amount = computed<Amount | undefined>(() => previewInvoice.value?.tax_summary?.total_amount);
const paymentFormAmount = computed<Amount>(() => amount.value ?? DEFAULT_PAYMENT_FORM_AMOUNT);

let previewTimer: ReturnType<typeof setTimeout> | undefined;
let previewRequestId = 0;

// Don't fetch a preview on every toggle; wait until the user stops clicking.
watch([selectedPricingItemIds, activeScheduleId], ([pricingItemIds, scheduleId]) => {
    clearTimeout(previewTimer);
    const requestId = ++previewRequestId;
    purchaseError.value = undefined;

    if (!scheduleId || pricingItemIds.length === 0) {
        previewInvoice.value = undefined;
        isPreviewPending.value = false;
        previewPendingPricingId.value = undefined;
        return;
    }

    isPreviewPending.value = true;
    previewTimer = setTimeout(() => {
        previewChargeOnDemandPricingItems({
            pricingPlanScheduleId: scheduleId,
            pricingItemIds,
        })
            .then((invoice) => {
                if (requestId === previewRequestId) {
                    previewInvoice.value = invoice;
                }
            })
            .catch((error) => {
                if (requestId !== previewRequestId) return;

                logger.error(
                    'INVOICE_PREVIEW_FAILED',
                    'Failed to load charge-on-demand invoice preview',
                    {},
                    error,
                );
                purchaseError.value = $t({
                    defaultMessage: 'Unable to calculate the total. Please try again.',
                    id: 'upgrade_subscription.preview_error',
                    description:
                        'Error message shown when the upgrade subscription invoice preview cannot be loaded',
                });
                previewInvoice.value = undefined;
            })
            .finally(() => {
                if (requestId === previewRequestId) {
                    isPreviewPending.value = false;
                    previewPendingPricingId.value = undefined;
                }
            });
    }, 400);
});

// Tells the payment form what it's charging for: the selected items on this subscription's schedule.
const authorizationContext = computed<ChargeOnDemandAuthorizationContext>(() => {
    if (!activeScheduleId.value) {
        throw new Error('Cannot create charge-on-demand authorization context without a schedule.');
    }

    return {
        type: 'CHARGE_ON_DEMAND',
        charge_on_demand: {
            pricing_plan_schedule_id: activeScheduleId.value,
            pricing_items: selectedPricingItemIds.value.map((pricingItemId) => ({
                pricing_item_id: pricingItemId,
            })),
        },
    };
});

const handleToggle = (pricingId: string) => {
    previewPendingPricingId.value = pricingId;
    if (selectedPricingIds.value.includes(pricingId)) {
        selectedPricingIds.value = selectedPricingIds.value.filter((id) => id !== pricingId);
    } else {
        selectedPricingIds.value = [...selectedPricingIds.value, pricingId];
    }
};

const canPurchase = computed(
    () =>
        selectedPricingItemIds.value.length > 0 &&
        !!activeScheduleId.value &&
        !!amount.value &&
        !isPreviewPending.value &&
        paymentMethodOptions.value.length > 0,
);

const purchaseError = ref<string | undefined>(undefined);

const handlePurchase = async () => {
    if (!canPurchase.value) return;

    purchaseError.value = undefined;
    if (hasSelectedPaymentMethod.value) {
        isPurchasePending.value = true;
    }
    paymentIntegrationFormRef.value?.submit();
};

const handleValidatePaymentSubmit = async () => canPurchase.value;

const handlePaymentMethodSelect = () => {
    hasSelectedPaymentMethod.value = true;
};

let redirectTimer: ReturnType<typeof setTimeout> | undefined;

const handlePaymentSuccess = () => {
    isPurchasePending.value = false;
    isPurchased.value = true;
    redirectTimer = setTimeout(() => {
        dispatchAction({ action: 'navigate-to-customer-overview' });
    }, 3000);
};

const handlePaymentFailed = (error: PaymentError) => {
    isPurchasePending.value = false;
    purchaseError.value =
        error.message ||
        $t({
            defaultMessage: 'Something went wrong. Please try again.',
            id: 'upgrade_subscription.purchase_error',
            description:
                'Error message shown when the purchase call fails on the upgrade subscription page',
        });
};

onUnmounted(() => {
    clearTimeout(previewTimer);
    clearTimeout(redirectTimer);
});
</script>

<template>
    <div
        v-if="isPurchased"
        class="sv-upgrade-subscription sv-root sv-screen sv-upgrade-subscription--purchased flex h-full items-center justify-center p-8"
    >
        <PaymentFeedbackCard
            class="sv-upgrade-subscription__success"
            status="success"
            :title="
                $t({
                    defaultMessage: 'Payment successful',
                    id: 'upgrade_subscription.success.title',
                    description: 'Title shown after a successful upgrade purchase',
                })
            "
        >
            <div class="flex flex-col items-center text-center">
            <Typography
                variant="body-sm"
                shade="lighter"
                tag="div"
                class="sv-upgrade-subscription__success-message mt-1"
                >{{
                    $t({
                        defaultMessage: 'Your purchase has been completed.',
                        id: 'upgrade_subscription.success.subtitle',
                        description: 'Subtitle shown after a successful upgrade purchase',
                    })
                }}
            </Typography>
            <Typography
                variant="body-sm"
                shade="lighter"
                tag="div"
                class="sv-upgrade-subscription__success-redirect mt-1"
                >{{
                    $t({
                        defaultMessage: 'You will be redirected shortly…',
                        id: 'upgrade_subscription.success.redirect',
                        description:
                            'Shown below the success message while the redirect timer is running',
                    })
                }}
            </Typography>
            </div>
        </PaymentFeedbackCard>
    </div>
    <ContentWithAsideLayout v-else class="sv-upgrade-subscription sv-root sv-screen">
        <template #header>
            <div class="sv-upgrade-subscription__header">
                <Typography variant="heading-2" tag="h1" class="sv-upgrade-subscription__title">
                    {{
                        $t({
                            defaultMessage: 'Upgrade subscription',
                            id: 'upgrade_subscription.title',
                            description: 'Title for the upgrade subscription page',
                        })
                    }}
                </Typography>
            </div>
        </template>

        <template #content>
            <UpgradeOrderSummary
                v-if="isMobileViewport"
                class="sv-upgrade-subscription__mobile-order-summary"
                :selected-pricings="selectedPricings"
                :invoice="previewInvoice"
                :loading="isPreviewPending"
            />

            <div
                v-if="!isLoadingItems && !loadError && categories.length > 0"
                class="sv-upgrade-subscription__pricing-list"
            >
                <OnDemandPricingList
                    :categories="categories"
                    :selected-pricing-ids="selectedPricingIds"
                    :loading-pricing-id="previewPendingPricingId"
                    @toggle="handleToggle"
                />
            </div>
            <div v-else-if="isLoadingItems" class="sv-upgrade-subscription__loading p-4">
                <div class="sv-skeleton h-[72px] animate-pulse rounded-md bg-gray-100" />
                <div class="sv-skeleton mt-2 h-[72px] animate-pulse rounded-md bg-gray-100" />
                <div class="sv-skeleton mt-2 h-[72px] animate-pulse rounded-md bg-gray-100" />
            </div>
            <ErrorNotification
                v-else-if="loadError"
                class="sv-upgrade-subscription__load-error sv-error m-4"
                :title="loadError"
            />
            <Typography
                v-else
                variant="body-sm"
                shade="lighter"
                class="sv-upgrade-subscription__empty-state p-4"
                >{{
                    $t({
                        defaultMessage: 'No one-off items are available for this subscription.',
                        id: 'upgrade_subscription.empty_state',
                        description:
                            'Shown when there are no one-off items available for the subscription',
                    })
                }}
            </Typography>

            <div class="sv-upgrade-subscription__payment-methods">
                <Skeleton variant="section" class="min-h-[130px]">
                    <div
                        v-if="
                            !isLoadingItems || (isLoadingItems && paymentMethodOptions.length > 0)
                        "
                        class="sv-upgrade-subscription__payment-methods-body"
                    >
                        <Typography
                            variant="heading-3"
                            tag="h2"
                            class="sv-upgrade-subscription__payment-methods-title mb-2"
                            >{{
                                $t({
                                    defaultMessage: 'Payment method',
                                    id: 'upgrade_subscription.payment_method_block.title',
                                    description:
                                        'The title of the payment method block in the upgrade subscription flow',
                                })
                            }}</Typography
                        >
                        <EmptyStatePlaceholder
                            v-if="paymentMethodOptions.length === 0"
                            class="sv-upgrade-subscription__payment-methods-empty"
                            icon="credit_card_off"
                        >
                            <template #title>
                                {{
                                    $t({
                                        defaultMessage: 'No payment methods available',
                                        id: 'upgrade_subscription.payment_method_block.no_payment_methods_available_title',
                                        description:
                                            'The title shown when there are no available payment methods',
                                    })
                                }}
                            </template>
                            <template #message>
                                {{
                                    $t({
                                        defaultMessage:
                                            'There are no available payment methods. Please contact support for more information.',
                                        id: 'upgrade_subscription.payment_method_block.no_payment_methods_available_message',
                                        description:
                                            'The message shown when there are no available payment methods',
                                    })
                                }}
                            </template>
                        </EmptyStatePlaceholder>
                        <div
                            v-else-if="countryCode && activeScheduleId"
                            class="sv-upgrade-subscription__payment-form"
                        >
                            <div class="sv-upgrade-subscription__payment-method-picker">
                                <PaymentIntegrationForm
                                    ref="paymentIntegrationFormRef"
                                    :customer-id="customerId"
                                    :country-code="countryCode"
                                    :context="authorizationContext"
                                    :amount="paymentFormAmount"
                                    variant="AUTHORIZE"
                                    :payment-method-options="paymentMethodOptions"
                                    :validate-on-submit="handleValidatePaymentSubmit"
                                    force-store-payment-method
                                    @select="handlePaymentMethodSelect"
                                    @payment-success="handlePaymentSuccess"
                                    @payment-failed="handlePaymentFailed"
                                />
                            </div>
                        </div>
                    </div>
                </Skeleton>
            </div>
        </template>

        <template #aside>
            <div class="sv-upgrade-subscription__order-summary">
                <Skeleton variant="section" class="min-h-[220px]">
                    <UpgradeOrderSummary
                        :selected-pricings="selectedPricings"
                        :invoice="previewInvoice"
                        :loading="isPreviewPending"
                    />
                </Skeleton>
            </div>

            <ErrorNotification
                v-if="purchaseError"
                class="sv-upgrade-subscription__error sv-error"
                :title="purchaseError"
            />

            <div class="flex flex-col gap-2">
                <Skeleton class="sv-upgrade-subscription__submit-skeleton min-h-[44px]">
                    <Button
                        size="lg"
                        class="sv-action sv-action--primary sv-action--full-width sv-upgrade-subscription__purchase w-full"
                        type="button"
                        :disabled="!canPurchase"
                        :loading="isPurchasePending"
                        @click="handlePurchase"
                    >
                        {{
                            $t({
                                defaultMessage: 'Purchase',
                                id: 'upgrade_subscription.purchase_button.label',
                                description:
                                    'Label for the purchase button on the upgrade subscription page',
                            })
                        }}
                    </Button>
                </Skeleton>

                <SecurePaymentsKPI :payment-method-options="paymentMethodOptions" />
            </div>
        </template>
    </ContentWithAsideLayout>
</template>
