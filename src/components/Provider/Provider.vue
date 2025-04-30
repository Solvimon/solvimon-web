<script setup lang="ts">
import {
    ErrorHandlingProvider,
    IconSpriteProvider,
    IntlProvider,
    type IntlMessages,
} from '@solvimon/ui';
import nlNlUiTranslations from '@solvimon/ui/translations/nl-NL';
import enUsUiTranslations from '@solvimon/ui/translations/en-US';
import { computed } from 'vue';
import type { ProviderEmits, ProviderProps } from './Provider.types';
import nlNlSdkTranslations from '@/translations/nl-NL.json';
import enUsSdkTranslations from '@/translations/en-US.json';
import AuthProvider from '@/components/AuthProvider/AuthProvider.vue';
import ConfigProvider from '@/components/ConfigProvider/ConfigProvider.vue';
import PortalProvider from '@/components/PortalProvider/PortalProvider.vue';

const props = defineProps<ProviderProps>();
defineEmits<ProviderEmits>();

if (!props.environment) {
    throw new Error('environment is required');
}

if (!props.token) {
    throw new Error('token is required');
}

const defaultMessages: Record<string, IntlMessages> = {
    'nl-NL': {
        ...nlNlUiTranslations,
        ...nlNlSdkTranslations,
    },
    'en-US': {
        ...enUsUiTranslations,
        ...enUsSdkTranslations,
    },
};
const localizedDefaultMessages = computed<IntlMessages>(() => {
    if (!props.locale || !(props.locale in defaultMessages)) {
        return defaultMessages['en-US'];
    }

    const localizedMessages = defaultMessages[props.locale];
    return localizedMessages;
});
const localizedMessages = computed<IntlMessages>(() => ({
    ...localizedDefaultMessages.value,
    ...props.messages,
}));
</script>

<template>
    <ErrorHandlingProvider @error="onError">
        <ConfigProvider v-if="environment" :environment="environment">
            <AuthProvider v-if="token" :token="token">
                <PortalProvider :token="token">
                    <IconSpriteProvider>
                        <IntlProvider
                            :locale="locale"
                            :date-locale="dateLocale"
                            :messages="localizedMessages"
                            :show-timezones="false"
                        >
                            <IconSpriteProvider>
                                <slot />
                            </IconSpriteProvider>
                        </IntlProvider>
                    </IconSpriteProvider>
                </PortalProvider>
            </AuthProvider>
        </ConfigProvider>
    </ErrorHandlingProvider>
</template>
