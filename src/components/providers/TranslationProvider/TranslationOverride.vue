<script setup lang="ts">
import { IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, inject } from 'vue';
import type { TranslationOverrideProps } from './TranslationProvider.types';
import { TRANSLATION_SETTINGS_KEY } from './TranslationProvider.lib';

/**
 * Replaces a message or two for one part of the tree only — for wording that belongs to a single
 * screen while the component saying it is shared. Everything not overridden is inherited from the
 * app's own translations, so the locale and the rest of the copy stay as they are.
 */
const props = defineProps<TranslationOverrideProps>();

const settings = inject(TRANSLATION_SETTINGS_KEY, undefined);

const messages = computed<IntlMessages>(() => ({
    ...settings?.messages.value,
    ...props.messages,
}));
</script>

<template>
    <IntlProvider
        :locale="settings?.locale.value"
        :date-locale="settings?.dateLocale.value"
        :messages="messages"
        :show-timezones="false"
    >
        <slot />
    </IntlProvider>
</template>
