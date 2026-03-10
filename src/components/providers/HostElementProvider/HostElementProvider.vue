<script setup lang="ts">
import { getCurrentInstance, provide, ref, onMounted, onUnmounted } from 'vue';
import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from './HostElementProvider.lib';
import type { HostElementProviderProps } from './HostElementProvider.types';

const { customElementName } = defineProps<HostElementProviderProps>();
const hostRef = ref<HTMLElement | null>(null);

onMounted(() => {
    const el = getCurrentInstance()?.vnode?.el;
    if (el && typeof el === 'object' && el instanceof Node) {
        const root = el.getRootNode();
        hostRef.value =
            root instanceof ShadowRoot ? (root.host as HTMLElement) : (el.parentElement ?? null);
    } else {
        hostRef.value = null;
    }
});

onUnmounted(() => {
    hostRef.value = null;
});

provide(HOST_ELEMENT_PROVIDER_INJECTION_KEY, { hostRef, customElementName });
</script>

<template>
    <slot />
</template>
