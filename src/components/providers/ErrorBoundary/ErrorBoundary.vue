<script setup lang="ts">
import { onErrorCaptured } from 'vue';
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import type { ProviderEmits } from '@/components/providers/Provider/Provider.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { CodedError } from '@/utils/error';

const emit = defineEmits<ProviderEmits>();
const logger = useLogger();

// The UI library reports here what it recovered from itself, such as a date it could only format
// in the browser's own time zone, so the host is not told the element failed.
const reportRecovered = (error: Error) =>
    logger.warn(
        'UI_COMPONENT_RECOVERED',
        'A UI component recovered from an error and carried on',
        {},
        error,
    );

// `ErrorHandlingProvider` only hands `onError` to the UI library's own components; anything else
// thrown below — in setup, a render, a watcher, a lifecycle hook or an event handler — and not
// handled on the way up arrives here.
onErrorCaptured((err, _instance, info) => {
    logger.capture(err, { info, ...(err instanceof CodedError ? { code: err.code } : {}) });
    emit('error', err instanceof Error ? err : new Error('Unhandled error', { cause: err }));

    return false;
});
</script>

<template>
    <ErrorHandlingProvider @error="reportRecovered">
        <slot />
    </ErrorHandlingProvider>
</template>
