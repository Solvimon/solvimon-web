<script setup lang="ts">
import type { EntryProviderProps } from './EntryProvider.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import type { EntryBaseEmits } from '@/types/EntryBaseProps';

defineProps<EntryProviderProps>();
defineEmits<EntryBaseEmits>();
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
        :primary-color="entry.branding?.colors?.primary"
        :secondary-color="entry.branding?.colors?.secondary"
        :experimental-features="entry.experimentalFeatures"
        :log-level="entry.logLevel"
        :on-log="entry.onLog"
        :css-overrides="entry.cssOverrides"
        @error="(error: Error) => $emit('error', error)"
    >
        <slot />
    </Provider>
</template>
