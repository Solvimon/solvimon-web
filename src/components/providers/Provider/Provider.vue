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
import RequiredPropertiesGuard from '@/components/providers/RequiredPropertiesGuard/RequiredPropertiesGuard.vue';
import HostElementProvider from '@/components/providers/HostElementProvider/HostElementProvider.vue';
import PortalProvider from '@/components/providers/PortalProvider/PortalProvider.vue';
import TranslationProvider from '@/components/providers/TranslationProvider/TranslationProvider.vue';

const props = defineProps<
    ProviderProps & {
        /** Required properties the entry was given no value for; nothing below renders until set. */
        missingProperties?: string[];
    }
>();
const emit = defineEmits<ProviderEmits>();
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
                    <LoggerProvider
                        :environment="environment"
                        :log-level="props.logLevel"
                        :on-log="props.onLog"
                    >
                        <ErrorBoundary @error="(error: Error) => emit('error', error)">
                            <RequiredPropertiesGuard :missing="missingProperties ?? []">
                                <ConfigProvider :environment="environment">
                                    <AuthProvider :token="portalObject.token">
                                        <ExperimentalFeatureProvider
                                            :experimental-features="experimentalFeatures"
                                        >
                                            <PortalProvider
                                                :allowed-portal-types="allowedPortalTypes"
                                                :portal-object="portalObject"
                                            >
                                                <IconSpriteProvider>
                                                    <TranslationProvider
                                                        :locale="locale"
                                                        :date-locale="dateLocale"
                                                        :messages="messages"
                                                    >
                                                        <slot />
                                                    </TranslationProvider>
                                                </IconSpriteProvider>
                                            </PortalProvider>
                                        </ExperimentalFeatureProvider>
                                    </AuthProvider>
                                </ConfigProvider>
                            </RequiredPropertiesGuard>
                        </ErrorBoundary>
                    </LoggerProvider>
                </TeleportProvider>
            </ActionDispatchProvider>
        </CssOverridesProvider>
    </HostElementProvider>
</template>
