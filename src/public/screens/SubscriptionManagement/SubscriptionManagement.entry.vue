<script setup lang="ts">
import SubscriptionManagement from './SubscriptionManagement.vue';
import { COMPONENT_NAME } from './SubscriptionManagement.entry.ce';
import type { SolvimonSubscriptionManagementEntryProps } from './SubscriptionManagement.entry.types';
import Provider from '@/components/providers/Provider/Provider.vue';

defineProps<SolvimonSubscriptionManagementEntryProps>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        :css-overrides="cssOverrides"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionManagement :configuration="configuration" />
    </Provider>
</template>
