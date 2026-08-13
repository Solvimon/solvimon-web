<script setup lang="ts">
import { IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, provide } from 'vue';
import type { TranslationProviderProps } from './TranslationProvider.types';
import {
    DEFAULT_LOCALE,
    isSupportedLocale,
    loadLocaleMessages,
    TRANSLATION_SETTINGS_KEY,
} from './TranslationProvider.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { useWatchAsync } from '@/composables/useWatchAsync';

const props = defineProps<TranslationProviderProps>();

const logger = useLogger();

const effectiveLocale = computed(() =>
    props.locale && isSupportedLocale(props.locale) ? props.locale : DEFAULT_LOCALE,
);

const { data: baseMessages, version: intlKey } = useWatchAsync<string, IntlMessages>(
    effectiveLocale,
    (locale) => loadLocaleMessages(locale, logger),
    {},
);

const localizedMessages = computed<IntlMessages>(() => ({
    ...baseMessages.value,
    ...props.messages,
}));

/** Handed down so a part of the tree can replace a message without restating the rest. */
provide(TRANSLATION_SETTINGS_KEY, {
    locale: effectiveLocale,
    dateLocale: computed(() => props.dateLocale),
    messages: localizedMessages,
});
</script>

<template>
    <IntlProvider
        :key="intlKey"
        :locale="effectiveLocale"
        :date-locale="dateLocale"
        :messages="localizedMessages"
        :show-timezones="false"
    >
        <slot />
    </IntlProvider>
</template>
