<script setup lang="ts">
import { IconSpriteProvider, IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { TranslationProviderProps } from './TranslationProvider.types';
import { loadLocaleMessages, supportedLocaleSet } from './TranslationProvider.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<TranslationProviderProps>();

const logger = useLogger();

const effectiveLocale = computed(() =>
    props.locale && supportedLocaleSet.has(props.locale) ? props.locale : 'en-US',
);

const baseMessages = ref<IntlMessages>({});

watch(effectiveLocale, async (locale) => {
    baseMessages.value = await loadLocaleMessages(locale, logger);
}, { immediate: true });

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
