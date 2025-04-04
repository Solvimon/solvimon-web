<script setup lang="ts">
import { IntlProvider } from '@solvimon/ui';
import AuthProvider from '../AuthProvider/AuthProvider.vue';
import ConfigProvider from '../ConfigProvider/ConfigProvider.vue';
import type { ProviderProps } from './Provider.types';
import PortalProvider from '../PortalProvider/PortalProvider.vue';

defineProps<ProviderProps>();
</script>

<template>
    <ConfigProvider :environment="environment">
        <AuthProvider :token="token">
            <PortalProvider :token="token">
                <IntlProvider :locale="locale" :date-locale="dateLocale" :messages="messages">
                    <slot />
                </IntlProvider>
            </PortalProvider>
        </AuthProvider>
    </ConfigProvider>
</template>