<script setup lang="ts">
import UpgradeSubscription from './UpgradeSubscription.vue';
import { COMPONENT_NAME } from './UpgradeSubscription.entry.ce';
import type { SolvimonUpgradeSubscriptionEntryProps } from './UpgradeSubscription.entry.types';
import Provider from '@/components/providers/Provider/Provider.vue';

defineProps<SolvimonUpgradeSubscriptionEntryProps>();
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
        <UpgradeSubscription :configuration="configuration" />
    </Provider>
</template>
