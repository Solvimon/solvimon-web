<script setup lang="ts">
import { computed } from 'vue';
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type {
    EnabledPricingsListEmits,
    EnabledPricingsListProps,
} from './EnabledPricingsList.types';
import { getEnabledPricingsEntries } from './EnabledPricingsList.lib';
import EnabledPricingsListItem from './EnabledPricingsListItem.vue';

const props = defineProps<EnabledPricingsListProps>();
defineEmits<EnabledPricingsListEmits>();

const { $t } = useIntl();

const entries = computed(() => getEnabledPricingsEntries(props.pricingPlanSchedule));
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
                @upgrade="$emit('upgrade', $event)"
            />
        </div>
    </Section>
</template>
