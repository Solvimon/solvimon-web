<script setup lang="ts">
import { computed, onUnmounted, watchEffect } from 'vue';
import type { CssOverridesProviderProps } from './CssOverridesProvider.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';

const props = defineProps<CssOverridesProviderProps>();
const { hostRef } = useHostElementProvider();

// Consumers can pass one CSS string or multiple CSS strings. We normalize that into one block.
const cssText = computed(() => {
    if (!props.cssOverrides) {
        return '';
    }

    return Array.isArray(props.cssOverrides)
        ? props.cssOverrides.filter(Boolean).join('\n').trim()
        : props.cssOverrides.trim();
});

let styleElement: HTMLStyleElement | undefined;

// Remove the injected style tag when there is no CSS anymore or when this provider unmounts.
const removeStyleElement = () => {
    styleElement?.remove();
    styleElement = undefined;
};

watchEffect(() => {
    // Customer CSS must be added inside the SDK shadow root, otherwise it cannot reach our UI.
    // This only works while our custom elements use an open shadow root.
    const root = hostRef.value?.shadowRoot;
    const css = cssText.value;

    // The SDK renders in shadow DOM, so overrides need to be placed inside that shadow root.
    if (!root) {
        return;
    }

    if (!css) {
        removeStyleElement();
        return;
    }

    // Append after the SDK styles so customer overrides win by normal CSS order.
    if (!styleElement || styleElement.getRootNode() !== root) {
        removeStyleElement();
        styleElement = document.createElement('style');
        styleElement.setAttribute('data-solvimon-css-overrides', '');
        root.appendChild(styleElement);
    }

    styleElement.textContent = css;
});

onUnmounted(removeStyleElement);
</script>

<template>
    <slot />
</template>
