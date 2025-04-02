<script setup lang="ts">
import { IntlProvider } from '@solvimon/ui';
import AuthProvider from '../AuthProvider/AuthProvider.vue';
import ConfigProvider from '../ConfigProvider/ConfigProvider.vue';
import type { ProviderProps } from './Provider.types';

defineProps<ProviderProps>();
</script>

<template>
    <ConfigProvider :environment="environment">
        <AuthProvider :token="token">
            <IntlProvider :locale="locale" :date-locale="dateLocale" :messages="messages">
                <slot />
            </IntlProvider>
        </AuthProvider>
    </ConfigProvider>
</template>