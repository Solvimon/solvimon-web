<script setup lang="ts">
import { inject, onErrorCaptured } from 'vue';
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import {
    dispatchHostEvent,
    HOST_ELEMENT_PROVIDER_INJECTION_KEY,
} from '@/components/providers/HostElementProvider/HostElementProvider.lib';
import type { SolvimonErrorDetail } from '@/public/core/events.types';
import { getSessionReference } from '@/utils/sessionReference';
import { CodedError } from '@/utils/error';

const logger = useLogger();
const host = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY, null);

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
    logger.capture(err, {
        info,
        ...(err instanceof CodedError
            ? { ...err.context, code: err.code, message: err.message }
            : {}),
    });
    // Named apart from the platform's `error`, which window error handlers and TypeScript treat as
    // a script error; carries what its log entry does, so a container can tell elements apart.
    const detail: SolvimonErrorDetail = {
        error: err instanceof Error ? err : new Error('Unhandled error', { cause: err }),
        code: err instanceof CodedError ? err.code : 'UNHANDLED_ERROR',
        componentName: host?.customElementName ?? '',
        reference: getSessionReference(),
    };
    dispatchHostEvent(host?.hostRef.value, 'solvimon-error', detail);

    return false;
});
</script>

<template>
    <ErrorHandlingProvider @error="reportRecovered">
        <slot />
    </ErrorHandlingProvider>
</template>
