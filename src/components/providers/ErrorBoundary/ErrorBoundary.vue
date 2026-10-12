<script setup lang="ts">
import { onErrorCaptured } from 'vue';
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import type { ProviderEmits } from '@/components/providers/Provider/Provider.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const emit = defineEmits<ProviderEmits>();
const logger = useLogger();

// `ErrorHandlingProvider` only hands `onError` to the UI library's own components; anything else
// thrown below — in setup, a render, a watcher, a lifecycle hook or an event handler — and not
// handled on the way up arrives here.
onErrorCaptured((err, _instance, info) => {
    logger.capture(err, { info });
    emit('error', err instanceof Error ? err : new Error('Unhandled error', { cause: err }));

    return false;
});
</script>

<template>
    <ErrorHandlingProvider @error="(err) => logger.capture(err)">
        <slot />
    </ErrorHandlingProvider>
</template>
