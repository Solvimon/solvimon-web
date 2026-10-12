<script setup lang="ts">
import { computed } from 'vue';
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type {
    EnabledPricingsListEmits,
    EnabledPricingsListProps,
} from './EnabledPricingsList.types';
import { getEnabledPricingsEntries } from './EnabledPricingsList.lib';
import EnabledPricingsListItem from './EnabledPricingsListItem.vue';
import { hasCustomizedPricings } from '@/utils/pricingPlanScheduleOverrides';

const props = defineProps<EnabledPricingsListProps>();
defineEmits<EnabledPricingsListEmits>();

const { $t } = useIntl();

const entries = computed(() => getEnabledPricingsEntries(props.pricingPlanSchedule));

/** Managing a subscription with customized pricing is refused, so it is not offered either. */
const canUpgrade = computed(
    () => !hasCustomizedPricings(props.pricingPlanSchedule.pricing_plan_schedule),
);
</script>

<template>
    <Section
        v-if="entries.length > 0"
        class="sv-enabled-pricings-list"
        content-background="none"
        no-border
        no-spacing
        :title="
            $t({
                defaultMessage: 'Upgrades',
                id: 'enabled_pricings_list.title',
                description: 'Title for the block listing the pricings enabled on a subscription',
            })
        "
    >
        <div class="sv-enabled-pricings-list__items grid grid-cols-1 gap-2">
            <EnabledPricingsListItem
                v-for="entry in entries"
                :key="entry.pricingId"
                :entry="entry"
                :can-upgrade="canUpgrade"
                @upgrade="$emit('upgrade', $event)"
            />
        </div>
    </Section>
</template>
