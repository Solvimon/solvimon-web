<script setup lang="ts">
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const logger = useLogger();
</script>

<template>
    <ErrorHandlingProvider @error="(err) => logger.capture(err)">
        <slot />
    </ErrorHandlingProvider>
</template>
