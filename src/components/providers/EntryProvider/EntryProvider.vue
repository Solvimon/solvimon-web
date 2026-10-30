<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { EntryProviderProps } from './EntryProvider.types';
import { getMissingProperties } from './EntryProvider.lib';
import Provider from '@/components/providers/Provider/Provider.vue';
import type { EntryBaseEmits } from '@/types/EntryBaseProps';
import type { ProviderSlots } from '@/components/providers/Provider/Provider.types';

// Every element loads EntryProvider, and only a revoked portal needs the notice.
const PortalNotAvailable = defineAsyncComponent(() =>
    import('@/components/shared/PortalNotAvailable.vue').then((m) => m.default),
);

const props = defineProps<EntryProviderProps>();
defineEmits<EntryBaseEmits>();
defineSlots<ProviderSlots>();

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
        :primary-color="entry.branding?.colors?.primary"
        :secondary-color="entry.branding?.colors?.secondary"
        :experimental-features="entry.experimentalFeatures"
        :log-level="entry.logLevel"
        :on-log="entry.onLog"
        :css-overrides="entry.cssOverrides"
        :missing-properties="missingProperties"
        @error="(error: Error) => $emit('error', error)"
    >
        <slot />
        <template #portal-unavailable="{ ending }">
            <slot name="portal-unavailable" :ending="ending"><PortalNotAvailable /></slot>
        </template>
    </Provider>
</template>
