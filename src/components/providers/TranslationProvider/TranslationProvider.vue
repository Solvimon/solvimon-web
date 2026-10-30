<script setup lang="ts">
import { IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, provide, watch } from 'vue';
import type { TranslationProviderProps } from './TranslationProvider.types';
import {
    DEFAULT_LOCALE,
    isSupportedLocale,
    loadLocaleMessages,
    parseHostMessages,
    TRANSLATION_SETTINGS_KEY,
    warnIfUnsupportedLocale,
} from './TranslationProvider.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { useWatchAsync } from '@/composables/useWatchAsync';

const props = defineProps<TranslationProviderProps>();

const logger = useLogger();

watch(
    () => props.locale,
    (locale) => warnIfUnsupportedLocale(locale, logger),
    { immediate: true },
);

const effectiveLocale = computed(() =>
    props.locale && isSupportedLocale(props.locale) ? props.locale : DEFAULT_LOCALE,
);

const { data: baseMessages, version: intlKey } = useWatchAsync<string, IntlMessages>(
    effectiveLocale,
    (locale) => loadLocaleMessages(locale, logger),
    {},
);

const { data: hostMessages, version: hostMessagesVersion } = useWatchAsync<
    IntlMessages | undefined,
    IntlMessages
>(
    () => props.messages,
    (messages) => parseHostMessages(messages, logger),
    {},
);

const localizedMessages = computed<IntlMessages>(() => ({
    ...baseMessages.value,
    ...hostMessages.value,
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
        <!-- Rendered once the catalogue and the host's messages are in, so the tree below renders translated the first time. -->
        <slot v-if="intlKey > 0 && hostMessagesVersion > 0" />
    </IntlProvider>
</template>
