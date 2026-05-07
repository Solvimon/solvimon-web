<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import type { StoryEntry } from '../registry';

const props = defineProps<{
    entry: StoryEntry;
    portalObject: Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solvimon: any;
}>();

// ---------------------------------------------------------------------------
// Configuration JSON editor
// ---------------------------------------------------------------------------

const configJson = ref(
    props.entry.defaultConfiguration
        ? JSON.stringify(props.entry.defaultConfiguration, null, 2)
        : '',
);
const configError = ref('');
const appliedConfig = ref<Record<string, unknown> | undefined>(
    props.entry.defaultConfiguration,
);

watch(
    () => props.entry,
    (entry) => {
        configJson.value = entry.defaultConfiguration
            ? JSON.stringify(entry.defaultConfiguration, null, 2)
            : '';
        appliedConfig.value = entry.defaultConfiguration;
        configError.value = '';
    },
);

function applyConfig() {
    if (!configJson.value.trim()) {
        appliedConfig.value = undefined;
        configError.value = '';
        return;
    }
    try {
        appliedConfig.value = JSON.parse(configJson.value);
        configError.value = '';
    } catch {
        configError.value = 'Invalid JSON';
    }
}

// ---------------------------------------------------------------------------
// Mount / unmount
// ---------------------------------------------------------------------------

const container = ref<HTMLDivElement | null>(null);
let unmount: (() => void) | null = null;

function mountEntry() {
    unmount?.();
    unmount = null;

    if (!container.value || !props.portalObject) return;

    const mountConfig: Record<string, unknown> = {
        container: container.value,
        portalObject: props.portalObject,
    };

    if (appliedConfig.value) {
        mountConfig.configuration = appliedConfig.value;
    }

    if (props.entry.kind === 'screen') {
        unmount = props.solvimon.createScreen(props.entry.id, mountConfig);
    } else {
        unmount = props.solvimon.createComponent(props.entry.id, mountConfig);
    }
}

watch([() => props.entry, () => props.portalObject, appliedConfig, container], mountEntry, {
    flush: 'post',
});

onUnmounted(() => unmount?.());
</script>

<template>
    <div class="canvas">
        <header class="canvas-header">
            <div class="canvas-meta">
                <span class="canvas-kind">{{ entry.kind }}</span>
                <h1 class="canvas-title">{{ entry.label }}</h1>
                <p class="canvas-description">{{ entry.description }}</p>
            </div>
        </header>

        <div class="canvas-body">
            <div v-if="!portalObject" class="placeholder">
                <p>Paste a portal object in the sidebar and click <strong>Apply</strong>.</p>
            </div>
            <div v-else ref="container" class="mount-root" />
        </div>

        <aside v-if="entry.defaultConfiguration !== undefined" class="config-panel">
            <p class="config-panel-label">Configuration</p>
            <textarea
                v-model="configJson"
                class="config-textarea"
                spellcheck="false"
            />
            <div class="config-actions">
                <span v-if="configError" class="config-error">{{ configError }}</span>
                <button class="apply-btn" @click="applyConfig">Apply</button>
            </div>
        </aside>
    </div>
</template>

<style scoped>
.canvas {
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* Header */
.canvas-header {
    padding: 28px 32px 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 20px;
}

.canvas-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.canvas-kind {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
}

.canvas-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
}

.canvas-description {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    max-width: 60ch;
}

/* Body */
.canvas-body {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
}

.placeholder {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 14px;
    text-align: center;
}

.mount-root {
    max-width: 960px;
}

/* Config panel */
.config-panel {
    border-top: 1px solid #e2e8f0;
    padding: 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.config-panel-label {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #94a3b8;
}

.config-textarea {
    width: 100%;
    height: 100px;
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    color: #0f172a;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
}

.config-textarea:focus {
    border-color: #93c5fd;
}

.config-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
}

.config-error {
    font-size: 12px;
    color: #ef4444;
}

.apply-btn {
    padding: 5px 14px;
    border: none;
    border-radius: 8px;
    background: #1d4ed8;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.apply-btn:hover {
    background: #1e40af;
}
</style>
