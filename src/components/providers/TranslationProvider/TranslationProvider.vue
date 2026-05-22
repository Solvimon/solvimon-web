<script setup lang="ts">
import { IconSpriteProvider, IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { TranslationProviderProps } from './TranslationProvider.types';
import { loadLocaleMessages, supportedLocaleSet } from './TranslationProvider.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createLatestGuard } from '@/utils/async';

const props = defineProps<TranslationProviderProps>();

const logger = useLogger();

const effectiveLocale = computed(() =>
    props.locale && supportedLocaleSet.has(props.locale) ? props.locale : 'en-US',
);

const baseMessages = ref<IntlMessages>({});

const latestLocaleLoad = createLatestGuard();

watch(
    effectiveLocale,
    async (locale) => {
        const isLatest = latestLocaleLoad();
        const messages = await loadLocaleMessages(locale, logger);
        if (isLatest()) {
            baseMessages.value = messages;
        }
    },
    { immediate: true },
);

const localizedMessages = computed<IntlMessages>(() => ({
    ...baseMessages.value,
    ...props.messages,
}));
</script>

<template>
    <IconSpriteProvider>
        <IntlProvider
            :locale="locale"
            :date-locale="dateLocale"
            :messages="localizedMessages"
            :show-timezones="false"
        >
            <slot />
        </IntlProvider>
    </IconSpriteProvider>
</template>
