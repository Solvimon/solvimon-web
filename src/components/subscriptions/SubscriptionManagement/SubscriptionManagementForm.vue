<script setup lang="ts">
import { computed, watch } from 'vue';
import { Divider, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing } from '@solvimon/solvimon-types';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type {
    SubscriptionManagementFormEmits,
    SubscriptionManagementFormProps,
} from './SubscriptionManagementForm.types';
import SubscriptionPlanSelector from './SubscriptionPlanSelector.vue';
import PricingGroupSingleEditor from '@/components/subscriptions/PlanCustomizationForm/PricingGroupSingleEditor.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';

const props = defineProps<SubscriptionManagementFormProps>();
const emit = defineEmits<SubscriptionManagementFormEmits>();

const enabledPricingIds = defineModel<Pricing['id'][]>('enabledPricingIds', { required: true });
const paymentMethodId = defineModel<PaymentMethod['id'] | undefined>('paymentMethodId');
const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();

/** One plan is no choice: the group only earns its section once there is somewhere to move to. */
const canChangePlan = computed(() => (props.planOptions?.length ?? 0) > 1);

/**
 * What the schedule can be customised with belongs to the plan it runs on, so once the customer
 * picks another plan there is nothing left to customise — the move starts the new plan on its own
 * defaults.
 */
const isChangingPlan = computed(() =>
    Boolean(
        canChangePlan.value &&
        pricingPlanId.value &&
        props.planOptions?.some(
            (option) => option.pricingPlanId === pricingPlanId.value && !option.isCurrent,
        ),
    ),
);

const toTime = (value?: string) => {
    const parsed = value ? Date.parse(value) : NaN;

    return Number.isFinite(parsed) ? parsed : 0;
};

/** Newest first, so a method the customer just added leads the list rather than trailing it. */
const sortedPaymentMethods = computed(() =>
    [...(props.paymentMethods ?? [])].sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
);

/**
 * Start on the customer's default payment method, falling back to the newest one — but prefer one
 * they have just added, since adding it was a deliberate act. Otherwise a choice they have already
 * made is left alone, so the list arriving late cannot overrule them.
 */
watch(
    () => props.paymentMethods,
    (paymentMethods, previousPaymentMethods) => {
        const addedPaymentMethod = paymentMethods?.find(
            ({ id }) => !previousPaymentMethods?.some((previous) => previous.id === id),
        );

        // Only a list that already had methods and then grew means the customer added one. Arriving
        // from nothing is the list loading, where the default should still win.
        if (addedPaymentMethod && previousPaymentMethods?.length) {
            paymentMethodId.value = addedPaymentMethod.id;
            return;
        }

        if (paymentMethods?.some(({ id }) => id === paymentMethodId.value)) {
            return;
        }

        paymentMethodId.value = (
            paymentMethods?.find(({ is_default }) => is_default) ?? sortedPaymentMethods.value[0]
        )?.id;
    },
    { immediate: true },
);
</script>

<template>
    <form class="sv-subscription-management-form" @submit.prevent>
        <div class="sv-subscription-management-form__body grid grid-cols-1 gap-4">
            <template v-if="canChangePlan">
                <SubscriptionPlanSelector
                    v-model:pricing-plan-id="pricingPlanId"
                    class="sv-subscription-management-form__plan"
                    :options="planOptions ?? []"
                    :group-name="planGroupName"
                    :disabled="disabled"
                />

                <div>
                    <Divider spacing="xs" />
                </div>
            </template>

            <PricingGroupSingleEditor
                v-if="pricingGroup && !isChangingPlan"
                v-model="enabledPricingIds"
                class="sv-subscription-management-form__pricing-group"
                :group-name="pricingGroup.name"
                :pricings="pricingGroup.pricings"
                :billing-period="billingPeriod"
                :currency="currency"
            />

            <div v-if="pricingGroup && !isChangingPlan">
                <Divider spacing="xs" />
            </div>

            <PaymentMethodSelector
                v-model="paymentMethodId"
                class="sv-subscription-management-form__payment-methods"
                :payment-methods="sortedPaymentMethods"
                :payment-method-options="paymentMethodOptions"
                required
                :disabled="disabled"
                :label="
                    $t({
                        defaultMessage: 'Payment method',
                        id: 'subscription_management.payment_method_selector.label',
                        description:
                            'Label above the payment method that pays for the subscription change',
                    })
                "
                @add-payment-method="emit('add-payment-method')"
            />
        </div>
    </form>
</template>
