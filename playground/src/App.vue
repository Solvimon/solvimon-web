<script setup lang="ts">
import { ref, watch } from 'vue';
import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import { screens, components, allEntries } from './registry';
import type { StoryEntry } from './registry';
import StoryCanvas from './components/StoryCanvas.vue';
import { SUPPORTED_LOCALES } from '@/translations/supported';

const LOCALE_STORAGE_KEY = 'solvimon-playground:locale';

const locale = ref(sessionStorage.getItem(LOCALE_STORAGE_KEY) ?? SUPPORTED_LOCALES[0]);
watch(locale, (value) => sessionStorage.setItem(LOCALE_STORAGE_KEY, value));

const solvimonConfig = {
    environment: 'TEST' as const,
    logLevel: 'info' as const,
    branding: {
        colors: {
            primary: '#1d4ed8',
            secondary: '#0f172a',
        },
    },
};

const solvimon = ref(createSolvimonCore({ ...solvimonConfig, locale: locale.value }));

watch(locale, (newLocale) => {
    solvimon.value = createSolvimonCore({ ...solvimonConfig, locale: newLocale });
});

const ACTIVE_ENTRY_STORAGE_KEY = 'solvimon-playground:active-entry';

function restoreActiveEntry(): StoryEntry {
    const stored = sessionStorage.getItem(ACTIVE_ENTRY_STORAGE_KEY);
    if (stored) {
        const found = allEntries.find((e) => e.id === stored);
        if (found) return found;
    }
    return screens[0];
}

const activeEntry = ref<StoryEntry>(restoreActiveEntry());

watch(activeEntry, (entry) => sessionStorage.setItem(ACTIVE_ENTRY_STORAGE_KEY, entry.id));

function portalStorageKey(entryId: string) {
    return `solvimon-playground:portal:${entryId}`;
}

function loadPortalJson(entry: StoryEntry): string {
    return sessionStorage.getItem(portalStorageKey(entry.id)) ?? '';
}

const portalJson = ref(loadPortalJson(activeEntry.value));
const portalError = ref('');

function parsePortalJson(json: string): Record<string, unknown> | null {
    if (!json.trim()) {
        portalError.value = '';
        return null;
    }

    try {
        portalError.value = '';
        return JSON.parse(json);
    } catch {
        portalError.value = 'Invalid JSON';
        return null;
    }
}

const portalObject = ref<Record<string, unknown> | null>(parsePortalJson(portalJson.value));

watch(activeEntry, (entry) => {
    portalJson.value = loadPortalJson(entry);
    portalObject.value = parsePortalJson(portalJson.value);
});

function applyPortal() {
    if (!portalJson.value.trim()) {
        portalObject.value = null;
        sessionStorage.removeItem(portalStorageKey(activeEntry.value.id));
        return;
    }
    const parsedPortalObject = parsePortalJson(portalJson.value);
    if (parsedPortalObject) {
        portalObject.value = parsedPortalObject;
        sessionStorage.setItem(portalStorageKey(activeEntry.value.id), portalJson.value);
    }
}
</script>

<template>
    <div class="layout">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <span class="logo">Solvimon Web</span>
                <span class="badge">Playground</span>
            </div>

            <nav class="nav">
                <div class="nav-group">
                    <p class="nav-group-label">Screens</p>
                    <button
                        v-for="entry in screens"
                        :key="entry.id"
                        class="nav-item"
                        :class="{ active: activeEntry.id === entry.id }"
                        @click="activeEntry = entry"
                    >
                        {{ entry.label }}
                    </button>
                </div>

                <div class="nav-group">
                    <p class="nav-group-label">Components</p>
                    <button
                        v-for="entry in components"
                        :key="entry.id"
                        class="nav-item"
                        :class="{ active: activeEntry.id === entry.id }"
                        @click="activeEntry = entry"
                    >
                        {{ entry.label }}
                    </button>
                </div>
            </nav>

            <!-- Locale switcher -->
            <div class="portal-section">
                <p class="portal-label">Locale</p>
                <select v-model="locale" class="locale-select">
                    <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
                        {{ loc }}
                    </option>
                </select>
            </div>

            <!-- Portal object -->
            <div class="portal-section">
                <p class="portal-label">Portal object</p>
                <textarea
                    v-model="portalJson"
                    class="portal-textarea"
                    spellcheck="false"
                    placeholder="Paste portal object JSON…"
                />
                <div class="portal-actions">
                    <span v-if="portalError" class="portal-error">{{ portalError }}</span>
                    <button class="apply-btn" :disabled="!portalJson" @click="applyPortal">
                        Apply
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main canvas -->
        <main class="main">
            <StoryCanvas
                :key="`${activeEntry.id}-${locale}`"
                :entry="activeEntry"
                :portal-object="portalObject"
                :solvimon="solvimon"
            />
        </main>
    </div>
</template>

<style scoped>
.layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100vh;
    overflow: hidden;
}

/* Sidebar */
.sidebar {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    overflow: hidden;
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
}

.logo {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
}

.badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
}

/* Nav */
.nav {
    flex: 1;
    overflow-y: auto;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.nav-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.nav-group-label {
    margin: 0 0 4px 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
}

.nav-item {
    display: block;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #475569;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition:
        background 0.1s,
        color 0.1s;
}

.nav-item:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.nav-item.active {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 600;
}

.locale-select {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: transparent;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
}

/* Portal section */
.portal-section {
    flex-shrink: 0;
    padding: 12px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.portal-label {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
}

.portal-textarea {
    width: 100%;
    height: 110px;
    padding: 8px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 11px;
    color: #0f172a;
    resize: none;
    outline: none;
    transition: border-color 0.15s;
}

.portal-textarea:focus {
    border-color: #93c5fd;
}

.portal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}

.portal-error {
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

.apply-btn:hover:not(:disabled) {
    background: #1e40af;
}

.apply-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* Main */
.main {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
}
</style>
