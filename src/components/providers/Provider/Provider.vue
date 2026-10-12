<script setup lang="ts">
import { BrandProvider, IconSpriteProvider } from '@solvimon/solvimon-ui';
import type { ProviderEmits, ProviderProps } from './Provider.types';
import CssOverridesProvider from '@/components/providers/CssOverridesProvider/CssOverridesProvider.vue';
import ActionDispatchProvider from '@/components/providers/ActionDispatchProvider/ActionDispatchProvider.vue';
import LoggerProvider from '@/components/providers/LoggerProvider/LoggerProvider.vue';
import ExperimentalFeatureProvider from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.vue';
import TeleportProvider from '@/components/providers/TeleportProvider/TeleportProvider.vue';
import ErrorBoundary from '@/components/providers/ErrorBoundary/ErrorBoundary.vue';
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
                <TeleportProvider>
                    <BrandProvider
                        :primary-color="primaryColor"
                        :secondary-color="secondaryColor"
                        is-shadow-root
                    />
                    <!-- Keyed, so that a new environment or portal token starts the tree below over
                    rather than leaving it on the API and session it was mounted with. -->
                    <ConfigProvider
                        v-if="environment"
                        :key="environment"
                        :environment="environment"
                    >
                        <LoggerProvider :log-level="props.logLevel" :on-log="props.onLog">
                            <ErrorBoundary>
                                <ExperimentalFeatureProvider
                                    :experimental-features="experimentalFeatures"
                                >
                                    <IconSpriteProvider>
                                        <TranslationProvider
                                            :locale="locale"
                                            :date-locale="dateLocale"
                                            :messages="messages"
                                        >
                                            <!-- Above the session, so a portal that cannot be used
                                            is refused without exchanging its token. -->
                                            <PortalProvider
                                                :allowed-portal-types="allowedPortalTypes"
                                                :portal-object="portalObject"
                                            >
                                                <AuthProvider
                                                    :key="portalObject.token"
                                                    :token="portalObject.token"
                                                >
                                                    <slot />
                                                </AuthProvider>
                                                <template #unavailable>
                                                    <slot name="portal-unavailable" />
                                                </template>
                                            </PortalProvider>
                                        </TranslationProvider>
                                    </IconSpriteProvider>
                                </ExperimentalFeatureProvider>
                            </ErrorBoundary>
                        </LoggerProvider>
                    </ConfigProvider>
                </TeleportProvider>
            </ActionDispatchProvider>
        </CssOverridesProvider>
    </HostElementProvider>
</template>
