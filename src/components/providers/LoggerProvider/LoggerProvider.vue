<script setup lang="ts">
import { provide } from 'vue';
import {
    combineLogSinks,
    createConsoleLogSink,
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

// Outside production the entries also go to the console: an integration that passes no `onLog`
// and does not listen for the `log` event would otherwise show nothing at all while debugging.
const sink = combineLogSinks(
    createCustomElementLogSink(props.onLog, hostRef),
    ...(environment === 'LIVE' ? [] : [createConsoleLogSink()]),
);

const logger = createLogger(sink, {
    logLevel: props.logLevel,
    customElementName,
    environment,
});

provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
</script>

<template>
    <slot />
</template>
