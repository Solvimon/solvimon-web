<script setup lang="ts">
import {
    IconSpriteProvider,
    IntlProvider,
    ErrorHandlingProvider,
    type IntlMessages,
    BrandProvider,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { ProviderEmits, ProviderProps } from './Provider.types';
import ActionDispatchProvider from '@/components/providers/ActionDispatchProvider/ActionDispatchProvider.vue';
import LoggerProvider from '@/components/providers/LoggerProvider/LoggerProvider.vue';
import ExperimentalFeatureProvider from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.vue';
import TeleportProvider from '@/components/providers/TeleportProvider/TeleportProvider.vue';
import { trackSentryException } from '@/utils/errorTracking';
import AuthProvider from '@/components/providers/AuthProvider/AuthProvider.vue';
import ConfigProvider from '@/components/providers/ConfigProvider/ConfigProvider.vue';
import HostElementProvider from '@/components/providers/HostElementProvider/HostElementProvider.vue';
import PortalProvider from '@/components/providers/PortalProvider/PortalProvider.vue';
import supportedLocales from '@/translations/supported.json';

const supportedLocaleSet: ReadonlySet<string> = new Set(supportedLocales);
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

async function loadLocaleMessages(locale: string): Promise<IntlMessages> {
    if (locale === 'nl-NL') {
        const [{ default: ui }, { default: sdk }] = await Promise.all([
            import('@solvimon/solvimon-ui/translations/nl-NL'),
            import('@/translations/nl-NL.json'),
        ]);
        return { ...ui, ...sdk };
    }
    const [{ default: ui }, { default: sdk }] = await Promise.all([
        import('@solvimon/solvimon-ui/translations/en-US'),
        import('@/translations/en-US.json'),
    ]);
    return { ...ui, ...sdk };
}

const effectiveLocale = computed(() =>
    props.locale && supportedLocaleSet.has(props.locale)
        ? props.locale
        : 'en-US',
);

const baseMessages = ref<IntlMessages>({});

watch(
    effectiveLocale,
    async (locale) => {
        baseMessages.value = await loadLocaleMessages(locale);
    },
    { immediate: true },
);

const localizedMessages = computed<IntlMessages>(() => ({
    ...baseMessages.value,
    ...props.messages,
}));
</script>

<template>
    <HostElementProvider :custom-element-name="props.customElementName">
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
        </ActionDispatchProvider>
    </HostElementProvider>
</template>
