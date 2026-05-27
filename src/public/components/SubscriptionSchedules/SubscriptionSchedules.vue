<script setup lang="ts">
import { PricingPlanSchedules, Section, useIntl } from '@solvimon/solvimon-ui';
import type { SubscriptionSchedulesProps } from './SubscriptionSchedules.types';

defineProps<SubscriptionSchedulesProps>();

const { $t } = useIntl();
</script>

<template>
    <Section
        class="sv-subscription-schedules sv-root sv-component"
        no-border
        no-spacing
        content-background="none"
        :title="
            $t({
                defaultMessage: 'Schedules',
                description: 'Invoices list title',
                id: 'invoices_list.title',
            })
        "
    >
        <PricingPlanSchedules class="sv-subscription-schedules__list" :schedules="schedulesData" />
    </Section>
</template>
