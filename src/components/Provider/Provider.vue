<script setup lang="ts">
import { IconSpriteProvider, IntlProvider } from '@solvimon/ui';
import type { ProviderProps } from './Provider.types';
import AuthProvider from '@/components/AuthProvider/AuthProvider.vue';
import ConfigProvider from '@/components/ConfigProvider/ConfigProvider.vue';
import PortalProvider from '@/components/PortalProvider/PortalProvider.vue';

defineProps<ProviderProps>();
</script>

<template>
    <ConfigProvider :environment="environment">
        <AuthProvider :token="token">
            <PortalProvider :token="token">
                <IntlProvider :locale="locale" :date-locale="dateLocale" :messages="messages">
                    <IconSpriteProvider>
                        <slot />
                    </IconSpriteProvider>
                </IntlProvider>
            </PortalProvider>
        </AuthProvider>
    </ConfigProvider>
</template>
