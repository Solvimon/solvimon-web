<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/solvimon-ui';
import type { SubscriptionManagementProps } from './SubscriptionManagement.types';
import { ContentWithAsideLayout } from '@/layouts';

defineProps<SubscriptionManagementProps>();

const { $t } = useIntl();
</script>

<template>
    <ContentWithAsideLayout class="sv-subscription-management sv-root sv-screen">
        <template #header>
            <div class="sv-subscription-management__header">
                <Typography variant="heading-2" tag="h1" class="sv-subscription-management__title">
                    {{
                        $t({
                            defaultMessage: 'Upgrade subscription',
                            id: 'subscription_management.title',
                            description: 'Title for the upgrade subscription page',
                        })
                    }}
                </Typography>
            </div>
        </template>

        <template #content>
            <!--
                Scaffolding only. The charge-on-demand flow that used to live here has been
                removed; build the upgrade flow out from `configuration.subscriptionId`.
            -->
        </template>
    </ContentWithAsideLayout>
</template>
