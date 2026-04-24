<script setup lang="ts">
import { PricingPlanSchedules, Section, useIntl } from '@solvimon/ui';
import type { SubscriptionSchedulesProps } from './SubscriptionSchedules.types';

defineProps<SubscriptionSchedulesProps>();

const { $t } = useIntl();
</script>

<template>
    <Section
        no-border
        spacing="none"
        content-background="none"
        :title="
            $t({
                defaultMessage: 'Schedules',
                description: 'Invoices list title',
                id: 'invoices_list.title',
            })
        "
    >
        <PricingPlanSchedules :schedules="schedulesData" />
    </Section>
</template>
