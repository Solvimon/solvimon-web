<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import { allEntries } from '../registry';
import {
    BRANDING,
    DEFAULT_LOCALE,
    STORAGE_KEYS,
    configStorageKey,
    parseEnvironment,
    parseJson,
    portalStorageKey,
} from '../playgroundState';
import type { PlaygroundCore, PlaygroundMountConfig } from '../playgroundState';

const entryId = new URLSearchParams(window.location.search).get('entry');
const entry = allEntries.find((candidate) => candidate.id === entryId);

const container = ref<HTMLDivElement | null>(null);
let unmount: (() => void) | null = null;

onMounted(() => {
    if (!entry || !container.value) return;

    const portalObject = parseJson(sessionStorage.getItem(portalStorageKey(entry.id)));

    if (!portalObject) return;

    const solvimon: PlaygroundCore = createSolvimonCore({
        environment: parseEnvironment(sessionStorage.getItem(STORAGE_KEYS.environment)),
        logLevel: 'info',
        branding: BRANDING,
        locale: sessionStorage.getItem(STORAGE_KEYS.locale) ?? DEFAULT_LOCALE,
    });

    const mountConfig: PlaygroundMountConfig = { container: container.value, portalObject };
    const configuration = parseJson(sessionStorage.getItem(configStorageKey(entry.id)));

    if (configuration) {
        mountConfig.configuration = configuration;
    }

    unmount =
        entry.kind === 'screen'
            ? solvimon.createScreen(entry.id, mountConfig)
            : solvimon.createComponent(entry.id, mountConfig);
});

onUnmounted(() => unmount?.());
</script>

<template>
    <div v-if="!entry" class="embed-message">Unknown entry “{{ entryId }}”.</div>
    <div v-else ref="container" class="embed-root" />
</template>

<style>
html,
body,
#app {
    height: 100%;
    background: #ffffff;
}
</style>

<style scoped>
.embed-root {
    min-height: 100%;
    padding: 16px;
    background: #ffffff;
}

.embed-message {
    padding: 16px;
    color: #94a3b8;
    font-size: 13px;
    text-align: center;
}
</style>
