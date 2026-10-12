<script setup lang="ts">
import { getCurrentInstance, provide, ref, onMounted, onUnmounted } from 'vue';
import {
    getCustomElementHost,
    HOST_ELEMENT_PROVIDER_INJECTION_KEY,
} from './HostElementProvider.lib';
import type { HostElementProviderProps } from './HostElementProvider.types';

const { customElementName } = defineProps<HostElementProviderProps>();
const instance = getCurrentInstance();

// Resolved during setup so the providers below can log, dispatch and adopt styles while they
// mount; `onMounted` here runs only after all of them have.
const hostRef = ref<HTMLElement | null>(getCustomElementHost(instance));

onMounted(() => {
    if (hostRef.value) return;

    const el = instance?.vnode?.el;
    if (el && typeof el === 'object' && el instanceof Node) {
        const root = el.getRootNode();
        hostRef.value = root instanceof ShadowRoot ? getHtmlHost(root) : (el.parentElement ?? null);
    }
});

onUnmounted(() => {
    hostRef.value = null;
});

provide(HOST_ELEMENT_PROVIDER_INJECTION_KEY, { hostRef, customElementName });

function getHtmlHost(root: ShadowRoot): HTMLElement | null {
    return root.host instanceof HTMLElement ? root.host : null;
}
</script>

<template>
    <slot />
</template>
