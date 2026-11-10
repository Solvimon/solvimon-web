<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { EntryProviderProps } from './EntryProvider.types';
import { getMissingProperties } from './EntryProvider.lib';
import Provider from '@/components/providers/Provider/Provider.vue';

// Every element loads EntryProvider, and only a revoked portal needs the notice.
const PortalNotAvailable = defineAsyncComponent(() =>
    import('@/components/shared/PortalNotAvailable.vue').then((m) => m.default),
);

const props = defineProps<EntryProviderProps>();

const missingProperties = computed(() =>
    getMissingProperties(props.entry, props.requiredConfiguration),
);
</script>

<template>
    <Provider
        :custom-element-name="componentName"
        :allowed-portal-types="allowedPortalTypes"
        :environment="entry.environment"
        :locale="entry.locale"
        :date-locale="entry.dateLocale"
        :messages="entry.messages"
        :portal-object="entry.portalObject"
        :portal-token="entry.portalToken"
        :primary-color="entry.branding?.colors?.primary ?? undefined"
        :secondary-color="entry.branding?.colors?.secondary ?? undefined"
        :experimental-features="entry.experimentalFeatures"
        :log-level="entry.logLevel"
        :on-log="entry.onLog"
        :css-overrides="entry.cssOverrides"
        :missing-properties="missingProperties"
    >
        <slot />
        <template #portal-unavailable>
            <slot name="portal-unavailable"><PortalNotAvailable /></slot>
        </template>
    </Provider>
</template>
