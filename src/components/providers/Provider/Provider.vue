<script setup lang="ts">
import {
    IconSpriteProvider,
    IntlProvider,
    ErrorHandlingProvider,
    type IntlMessages,
    BrandProvider,
} from '@solvimon/ui';
import nlNlUiTranslations from '@solvimon/ui/translations/nl-NL';
import enUsUiTranslations from '@solvimon/ui/translations/en-US';
import { computed } from 'vue';
import type { ProviderEmits, ProviderProps } from './Provider.types';
import LoggerProvider from '@/components/providers/LoggerProvider/LoggerProvider.vue';
import ExperimentalFeatureProvider from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.vue';
import TeleportProvider from '@/components/providers/TeleportProvider/TeleportProvider.vue';
import { trackSentryException } from '@/utils/errorTracking';
import AuthProvider from '@/components/providers/AuthProvider/AuthProvider.vue';
import nlNlSdkTranslations from '@/translations/nl-NL.json';
import enUsSdkTranslations from '@/translations/en-US.json';
import ConfigProvider from '@/components/providers/ConfigProvider/ConfigProvider.vue';
import PortalProvider from '@/components/providers/PortalProvider/PortalProvider.vue';

const props = defineProps<ProviderProps>();
defineEmits<ProviderEmits>();

if (!props.environment) {
    throw new Error('environment is required');
}

if (!props.token && !props.portalObject) {
    throw new Error('token or portalObject is required');
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
    <ErrorHandlingProvider @error="trackSentryException">
        <TeleportProvider>
            <BrandProvider
                :primary-color="primaryColor"
                :secondary-color="secondaryColor"
                is-shadow-root
            />
            <ConfigProvider
                v-if="environment"
                :environment="environment"
                :custom-element-name="customElementName"
            >
                <LoggerProvider :log-level="props.logLevel" :on-log="props.onLog">
                    <AuthProvider v-if="token" :token="token">
                        <ExperimentalFeatureProvider :experimental-features="experimentalFeatures">
                            <PortalProvider
                                :token="token"
                                :allowed-portal-types="allowedPortalTypes"
                                :portal-object="portalObject"
                            >
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
                            </PortalProvider>
                        </ExperimentalFeatureProvider>
                    </AuthProvider>
                </LoggerProvider>
            </ConfigProvider>
        </TeleportProvider>
    </ErrorHandlingProvider>
</template>
