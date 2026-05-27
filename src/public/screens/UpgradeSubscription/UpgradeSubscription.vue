<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Typography,
    useIntl,
    Button,
    Divider,
    ErrorNotification,
    Icon,
    Section,
} from '@solvimon/solvimon-ui';
import type { Invoice } from '@solvimon/solvimon-types';
import type { UpgradeSubscriptionProps } from './UpgradeSubscription.types';
import {
    getMockOnDemandPricingItemsResponse,
    getMockPreviewResponse,
} from './UpgradeSubscription.mocks';
import type { OnDemandPricing } from '@/components/subscriptions/UpgradeSubscription/UpgradeSubscription.types';
import UpgradeOrderSummary from '@/components/subscriptions/UpgradeOrderSummary.vue';
import OnDemandPricingList from '@/components/subscriptions/OnDemandPricingList.vue';
import PaymentMethodPicker from '@/components/subscriptions/PaymentMethodPicker.vue';
import { ContentWithAsideLayout } from '@/layouts';
import Kpi from '@/components/shared/Kpi.vue';
import { useActionDispatchProvider, usePortal } from '@/components/providers';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';

const props = defineProps<UpgradeSubscriptionProps>();
const { $t } = useIntl();
const { dispatchAction } = useActionDispatchProvider();
const { chargeOnDemandPricingItems } = createPricingPlanSchedulesService();
const portal = usePortal();

const customerId = computed(() => portal.value.customer_id);

const selectedPricingIds = ref<string[]>([]);
const selectedPaymentMethodId = ref<string | undefined>(undefined);
const isPurchasePending = ref(false);
const isPurchased = ref(false);
const previewInvoice = ref<Invoice | undefined>(undefined);
const isPreviewPending = ref(false);

// --- Data (mock until real service is wired) ---

const mockResponse = computed(() =>
    getMockOnDemandPricingItemsResponse(props.configuration.subscriptionId),
);

const categories = computed(() => mockResponse.value.pricing_categories);

// --- Flat list of all available on-demand pricings (for order summary) ---

const allOnDemandPricings = computed<OnDemandPricing[]>(() =>
    categories.value.flatMap((cat) => [
        ...(cat.pricings ?? []),
        ...(cat.pricing_groups ?? []).flatMap((g) => g.pricings ?? []),
    ]),
);

const selectedPricings = computed<OnDemandPricing[]>(() =>
    allOnDemandPricings.value.filter((p) => selectedPricingIds.value.includes(p.id)),
);

// --- Preview (debounced) ---

let previewTimer: ReturnType<typeof setTimeout> | undefined;

watch(selectedPricingIds, (ids) => {
    clearTimeout(previewTimer);
    if (ids.length === 0) {
        previewInvoice.value = undefined;
        isPreviewPending.value = false;
        return;
    }
    isPreviewPending.value = true;
    previewTimer = setTimeout(() => {
        // TODO: Replace with real service call — previewOnDemandPricingItems(...)
        previewInvoice.value = getMockPreviewResponse(ids).invoice;
        isPreviewPending.value = false;
    }, 400);
});

// --- Cart toggle ---

const handleToggle = (pricingId: string) => {
    if (selectedPricingIds.value.includes(pricingId)) {
        selectedPricingIds.value = selectedPricingIds.value.filter((id) => id !== pricingId);
    } else {
        selectedPricingIds.value = [...selectedPricingIds.value, pricingId];
    }
};

// --- Purchase ---

const canPurchase = computed(
    () => selectedPricingIds.value.length > 0 && !!selectedPaymentMethodId.value,
);

const purchaseError = ref<string | undefined>(undefined);

/** Saved payment method IDs use the pmet_ prefix. Adyen type strings (ideal, scheme…) do not. */
const isSavedPaymentMethod = (id: string) => id.startsWith('pmet_');

const handlePurchase = async () => {
    if (!canPurchase.value) return;

    isPurchasePending.value = true;
    purchaseError.value = undefined;
    try {
        const pricingItemIds = selectedPricings.value
            .map((p) => p.items?.[0]?.id)
            .filter((id): id is string => !!id);

        const savedMethodId =
            selectedPaymentMethodId.value && isSavedPaymentMethod(selectedPaymentMethodId.value)
                ? selectedPaymentMethodId.value
                : undefined;

        const invoice = await chargeOnDemandPricingItems({
            scheduleId: mockResponse.value.pricing_plan_schedule_id,
            pricingPlanVersionId: mockResponse.value.pricing_plan_version_id,
            pricingItemIds,
            finalizeImmediately: true,
            paymentMethodId: savedMethodId,
        });

        if (savedMethodId) {
            // Saved method: invoice is created and paid in one shot — show success inline.
            isPurchased.value = true;
        } else {
            // New payment method: invoice created, payment still needed — hand off to invoice-pay.
            dispatchAction({ action: 'pay-invoice', data: { invoiceId: invoice.id } });
        }
    } catch {
        purchaseError.value = $t({
            defaultMessage: 'Something went wrong. Please try again.',
            id: 'upgrade_subscription.purchase_error',
            description:
                'Error message shown when the purchase call fails on the upgrade subscription page',
        });
    } finally {
        isPurchasePending.value = false;
    }
};
</script>

<template>
    <!-- Success state -->
    <div
        v-if="isPurchased"
        class="sv-upgrade-subscription sv-root sv-screen sv-upgrade-subscription--purchased flex h-full items-center justify-center p-8"
    >
        <Section class="sv-upgrade-subscription__success">
            <div class="sv-upgrade-subscription__success-body flex flex-col items-center py-10">
                <Icon
                    icon="check_circle"
                    class="sv-upgrade-subscription__success-icon text-green-400"
                    size="lg"
                />
                <Typography
                    variant="heading-3"
                    tag="span"
                    class="sv-upgrade-subscription__success-title mt-2"
                >{{
                    $t({
                        defaultMessage: 'Payment successful',
                        id: 'upgrade_subscription.success.title',
                        description: 'Title shown after a successful add-on purchase',
                    })
                }}</Typography>
                <Typography
                    variant="body-sm"
                    shade="lighter"
                    tag="span"
                    class="sv-upgrade-subscription__success-message mt-1"
                >{{
                    $t({
                        defaultMessage: 'Your add-ons have been activated.',
                        id: 'upgrade_subscription.success.subtitle',
                        description: 'Subtitle shown after a successful add-on purchase',
                    })
                }}</Typography>
            </div>
        </Section>
    </div>

    <!-- Main flow -->
    <ContentWithAsideLayout v-else class="sv-upgrade-subscription sv-root sv-screen">
        <template #content>
            <OnDemandPricingList
                v-if="categories.length > 0"
                class="sv-upgrade-subscription__pricing-list"
                :categories="categories"
                :selected-pricing-ids="selectedPricingIds"
                @toggle="handleToggle"
            />
            <Typography
                v-else
                variant="body-sm"
                shade="lighter"
                class="sv-upgrade-subscription__empty-state p-4"
            >{{
                $t({
                    defaultMessage: 'No on-demand add-ons are available for this subscription.',
                    id: 'upgrade_subscription.empty_state',
                    description:
                        'Shown when there are no on-demand add-ons available for the subscription',
                })
            }}</Typography>

            <Divider spacing="sm" />

            <PaymentMethodPicker
                class="sv-upgrade-subscription__payment-method-picker"
                :customer-id="customerId"
                :subscription-id="configuration.subscriptionId"
                :selected-id="selectedPaymentMethodId"
                @select="selectedPaymentMethodId = $event"
            />
        </template>

        <template #aside>
            <UpgradeOrderSummary
                class="sv-upgrade-subscription__order-summary"
                :selected-pricings="selectedPricings"
                :invoice="previewInvoice"
                :is-pending="isPreviewPending"
            />

            <ErrorNotification
                v-if="purchaseError"
                class="sv-upgrade-subscription__error"
                :title="purchaseError"
            />

            <Button
                size="lg"
                class="sv-action sv-action--primary sv-action--full-width sv-upgrade-subscription__purchase full-width"
                type="button"
                :disabled="!canPurchase || isPurchasePending"
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

            <Typography
                tag="div"
                variant="body-sm"
                shade="lighter"
                class="sv-upgrade-subscription__trust-indicator flex grow justify-center"
            >
                <Kpi
                    icon="lock"
                    :kpi="
                        $t({
                            defaultMessage: 'Secure and encrypted payments',
                            id: 'upgrade_subscription.kpi.encrypted_payments.label',
                            description:
                                'The encrypted payments KPI shown on the upgrade subscription page',
                        })
                    "
                />
            </Typography>
        </template>
    </ContentWithAsideLayout>
</template>
