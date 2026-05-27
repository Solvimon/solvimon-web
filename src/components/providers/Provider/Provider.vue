<script setup lang="ts">
import { ErrorHandlingProvider, BrandProvider } from '@solvimon/solvimon-ui';
import type { ProviderEmits, ProviderProps } from './Provider.types';
import CssOverridesProvider from '@/components/providers/CssOverridesProvider/CssOverridesProvider.vue';
import ActionDispatchProvider from '@/components/providers/ActionDispatchProvider/ActionDispatchProvider.vue';
import LoggerProvider from '@/components/providers/LoggerProvider/LoggerProvider.vue';
import ExperimentalFeatureProvider from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.vue';
import TeleportProvider from '@/components/providers/TeleportProvider/TeleportProvider.vue';
import { trackSentryException } from '@/utils/errorTracking';
import AuthProvider from '@/components/providers/AuthProvider/AuthProvider.vue';
import ConfigProvider from '@/components/providers/ConfigProvider/ConfigProvider.vue';
import HostElementProvider from '@/components/providers/HostElementProvider/HostElementProvider.vue';
import PortalProvider from '@/components/providers/PortalProvider/PortalProvider.vue';
import TranslationProvider from '@/components/providers/TranslationProvider/TranslationProvider.vue';

const props = defineProps<ProviderProps>();
defineEmits<ProviderEmits>();

if (!props.environment) {
    throw new Error('environment is required');
}

if (!props.portalObject) {
    throw new Error('portalObject is required');
}

if (!props.customElementName) {
    throw new Error('customElementName is required');
}
</script>

<template>
    <HostElementProvider :custom-element-name="props.customElementName">
        <CssOverridesProvider :css-overrides="props.cssOverrides">
            <ActionDispatchProvider>
                <ErrorHandlingProvider @error="trackSentryException">
                    <TeleportProvider>
                        <BrandProvider
                            :primary-color="primaryColor"
                            :secondary-color="secondaryColor"
                            is-shadow-root
                        />
                        <ConfigProvider v-if="environment" :environment="environment">
                            <LoggerProvider :log-level="props.logLevel" :on-log="props.onLog">
                                <AuthProvider :token="portalObject.token">
                                    <ExperimentalFeatureProvider
                                        :experimental-features="experimentalFeatures"
                                    >
                                        <PortalProvider
                                            :allowed-portal-types="allowedPortalTypes"
                                            :portal-object="portalObject"
                                        >
                                            <TranslationProvider
                                                :locale="locale"
                                                :date-locale="dateLocale"
                                                :messages="messages"
                                            >
                                                <slot />
                                            </TranslationProvider>
                                        </PortalProvider>
                                    </ExperimentalFeatureProvider>
                                </AuthProvider>
                            </LoggerProvider>
                        </ConfigProvider>
                    </TeleportProvider>
                </ErrorHandlingProvider>
            </ActionDispatchProvider>
        </CssOverridesProvider>
    </HostElementProvider>
</template>
