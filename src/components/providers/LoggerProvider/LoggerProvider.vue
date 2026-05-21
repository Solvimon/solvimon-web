<script setup lang="ts">
import { provide } from 'vue';
import {
    createCustomElementLogSink,
    createLogger,
    LOGGER_PROVIDER_INJECTION_KEY,
} from './LoggerProvider.lib';
import type { LoggerProviderProps } from './LoggerProvider.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

const props = withDefaults(defineProps<LoggerProviderProps>(), {
    onLog: () => {},
});
const { customElementName, hostRef } = useHostElementProvider();
const { environment } = useConfig();
const logger = createLogger(createCustomElementLogSink(props.onLog, hostRef), {
    minLevel: props.logLevel,
    customElementName,
    environment,
});

provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
</script>

<template>
    <slot />
</template>
