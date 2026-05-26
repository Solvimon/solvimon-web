<script setup lang="ts">
import { IconSpriteProvider, IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { TranslationProviderProps } from './TranslationProvider.types';
import { DEFAULT_LOCALE, isSupportedLocale, loadLocaleMessages } from './TranslationProvider.lib';
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
</script>

<template>
    <IconSpriteProvider>
        <IntlProvider
            :key="intlKey"
            :locale="effectiveLocale"
            :date-locale="dateLocale"
            :messages="localizedMessages"
            :show-timezones="false"
        >
            <slot />
        </IntlProvider>
    </IconSpriteProvider>
</template>
