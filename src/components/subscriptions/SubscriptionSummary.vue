<script setup lang="ts">
import { Avatar, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { SubscriptionSummaryProps } from './SubscriptionSummary.types';
import {
    findPricingsByIds,
    getMostRecentPricingPlan,
    getSubscriptionName,
} from '@/utils/subscription';
import { getNameFromPricing } from '@/utils/pricing';

const props = defineProps<SubscriptionSummaryProps>();

const { $t } = useIntl();

const mostRecentPricingPlan = computed(() => getMostRecentPricingPlan(props.subscription));

const name = computed(() =>
    getSubscriptionName({
        subscription: props.subscription,
        fallback: $t({
            defaultMessage: 'Subscription',
            description: 'The fallback name for when no subscription name can be determined',
            id: 'customer_overview.subscriptions_block.fallback_subscription_name',
        }),
    }),
);

const description = computed(
    () => props.subscription.description || mostRecentPricingPlan.value?.description,
);

const selectedPricings = computed(() => {
    if (!props.subscription || !props.enabledPricingIds) {
        return undefined;
    }

    const pricings = findPricingsByIds(props.subscription, props.enabledPricingIds);

    return pricings?.map(getNameFromPricing).join(' - ');
});
</script>

<template>
    <div class="flex flex-row gap-3" :class="noSpacing ? undefined : 'px-3 py-2'">
        <Avatar v-if="avatar" :image-src="avatar" size="lg" class="my-1" />
        <div class="min-w-0 grow" :title="name">
            <Typography variant="body" weight="semibold" no-spacing class="truncate">{{
                name
            }}</Typography>
            <Typography v-if="selectedPricings" variant="body-xs" color="subtle" no-spacing>{{
                selectedPricings
            }}</Typography>
            <Typography v-if="description" variant="body-xs" color="subtle" no-spacing>
                <template v-if="selectedPricings"> • </template>
                {{ description }}</Typography
            >
        </div>
    </div>
</template>
