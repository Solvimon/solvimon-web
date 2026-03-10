<script setup lang="ts">
import CustomerOverview from './CustomerOverview.vue';
import { COMPONENT_NAME } from './CustomerOverview.entry.ce';
import type { CustomerOverviewEntryProps } from './CustomerOverview.entry.types';
import Provider from '@/components/providers/Provider/Provider.vue';

defineProps<Partial<CustomerOverviewEntryProps>>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token || portalObject?.token"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="() => {}"
        @error="(error) => $emit('error', error)"
    >
        <CustomerOverview />
    </Provider>
</template>
