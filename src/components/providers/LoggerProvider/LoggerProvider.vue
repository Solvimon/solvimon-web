<script setup lang="ts">
import { provide } from 'vue';
import type { Environment } from '@solvimon/solvimon-types';
import {
    combineLogSinks,
    createConsoleLogSink,
    createCustomElementLogSink,
    createLogger,
    LOGGER_PROVIDER_INJECTION_KEY,
} from './LoggerProvider.lib';
import type { LoggerProviderProps } from './LoggerProvider.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';

// Takes the environment as given rather than from ConfigProvider, which sits below it so that a
// configuration it rejects is logged.
const props = withDefaults(defineProps<LoggerProviderProps & { environment?: Environment }>(), {
    onLog: () => {},
});
const { customElementName, hostRef } = useHostElementProvider();

// Outside production the entries also go to the console: an integration that passes no `onLog`
// and does not listen for the `log` event would otherwise show nothing at all while debugging.
const sink = combineLogSinks(
    createCustomElementLogSink(props.onLog, hostRef),
    ...(props.environment === 'LIVE' ? [] : [createConsoleLogSink()]),
);

const logger = createLogger(sink, {
    logLevel: props.logLevel,
    customElementName,
    environment: props.environment,
});

provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
</script>

<template>
    <slot />
</template>
