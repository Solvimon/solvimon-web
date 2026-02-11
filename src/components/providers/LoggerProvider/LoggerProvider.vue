<script setup lang="ts">
import { provide } from 'vue';
import { createLogger, LOGGER_PROVIDER_INJECTION_KEY } from './LoggerProvider.lib';
import type { LoggerProviderProps } from './LoggerProvider.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

const props = withDefaults(defineProps<LoggerProviderProps>(), {
    minLevel: 'error',
    onLog: () => {},
});
const { customElementName, environment } = useConfig();
const logger = createLogger(props.onLog, {
    minLevel: props.logLevel,
    customElementName,
    environment,
});

provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
</script>

<template>
    <slot />
</template>
