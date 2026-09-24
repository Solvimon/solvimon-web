<script setup lang="ts">
import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import type { Environment, LogEntry, RegisteredScreenId } from '@solvimon/solvimon-web/core';
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * What a Playwright test hands the app through `window.__SOLVIMON_TEST_CONFIG__`, set by an init
 * script so it is in place before the app boots. Without one the app keeps its original behaviour:
 * the DEV portal object below, steered by `?email=` and `?country=`.
 */
interface TestConfig {
    screen?: RegisteredScreenId;
    environment?: string;
    locale?: string;
    portalObject?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
}

/** What the tests read back, so the host side of the contract can be asserted on too. */
interface RecordedEvents {
    logs: { level: string; code: string; message: string }[];
    errors: string[];
    ready: number;
}

declare global {
    interface Window {
        __SOLVIMON_TEST_CONFIG__?: TestConfig;
        __SOLVIMON_EVENTS__?: RecordedEvents;
    }
}

const screenContainer = ref<HTMLDivElement | null>(null);

const events: RecordedEvents = { logs: [], errors: [], ready: 0 };
window.__SOLVIMON_EVENTS__ = events;

const testConfig = window.__SOLVIMON_TEST_CONFIG__;

const getQueryParam = (name: string) =>
    new URLSearchParams(window.location.search).get(name) ?? undefined;

const DEFAULT_PORTAL_OBJECT = {
    object_type: 'PORTAL_URL',
    id: 'purl_PwDmbS0v5xMRnNCvrp14',
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
    pricing_plan_id: 'ppl_example',
    token: 'WkM0ZHh1czVrTnBUWEhDbW9BQ3hJSmVMTHJONFFaNHEucHVybF9Qd0RtYlMwdjV4TVJuTkN2cnAxNA==',
    status: 'PUBLISHED',
};

const portalObject = testConfig?.portalObject ?? DEFAULT_PORTAL_OBJECT;

const configuration = testConfig?.configuration ?? {
    email: getQueryParam('email'),
    countryCode: getQueryParam('country'),
};

const handleLog = (entry: LogEntry) => {
    events.logs.push({ level: entry.level, code: entry.code, message: entry.message });

    if (entry.level === 'error') {
        console.error(entry.code, entry.message);
    }
};

const solvimon = createSolvimonCore({
    // The test app runs against `npm run build:internal`, the only build in which DEV resolves.
    // The published `Environment` is `TEST | LIVE`, so naming an internal one needs a cast.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    environment: (testConfig?.environment ?? 'DEV') as unknown as Environment,
    locale: testConfig?.locale ?? 'en-US',
    logLevel: 'info',
    onLog: handleLog,
});

let unmountScreen: (() => void) | null = null;

/**
 * `ready` and `error` are dispatched on the custom element, which the SDK appends asynchronously.
 * Listening on the container in the capture phase catches them either way: capture reaches an
 * ancestor even for events that do not bubble.
 */
const getErrorMessage = (event: Event): string => {
    if (!('detail' in event)) return 'unknown error';

    const detail = event.detail;
    if (typeof detail === 'object' && detail !== null && 'message' in detail) {
        return String(detail.message);
    }

    return 'unknown error';
};

const recordScreenEvents = (container: HTMLElement) => {
    container.addEventListener('ready', () => (events.ready += 1), true);
    container.addEventListener(
        'error',
        (event) => events.errors.push(getErrorMessage(event)),
        true,
    );
};

onMounted(() => {
    if (!screenContainer.value) return;

    recordScreenEvents(screenContainer.value);

    unmountScreen = solvimon.createScreen(testConfig?.screen ?? 'checkout', {
        container: screenContainer.value,
        // Neither the portal object's type nor a screen's configuration is known to consumers that
        // cannot install the types package, and this app mounts whichever screen a test names.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        portalObject: portalObject as never,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        configuration: configuration as never,
    });
});

onUnmounted(() => {
    unmountScreen?.();
});
</script>

<template>
    <div class="app">
        <h1>Solvimon Test App</h1>
        <div ref="screenContainer" class="screen-root" />
    </div>
</template>

<style scoped>
.app {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

h1 {
    margin-bottom: 2rem;
}

.screen-root {
    min-height: 320px;
}
</style>
