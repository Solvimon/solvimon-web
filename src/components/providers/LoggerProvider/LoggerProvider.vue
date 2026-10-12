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

// Every prop is read when an entry is logged rather than here: plain HTML sets them on the element
// after it has mounted. Outside production the entries also go to the console, since an
// integration that passes no `onLog` and does not listen for `log` would otherwise see nothing.
const consoleSink = createConsoleLogSink();
const sink = combineLogSinks(
    createCustomElementLogSink((entry) => props.onLog(entry), hostRef),
    (entry) => {
        if (props.environment !== 'LIVE') consoleSink(entry);
    },
);

const logger = createLogger(sink, {
    get logLevel() {
        return props.logLevel;
    },
    customElementName,
    get environment() {
        return props.environment;
    },
});

provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
</script>

<template>
    <slot />
</template>
