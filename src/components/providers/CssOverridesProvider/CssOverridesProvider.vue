<script setup lang="ts">
import { computed, onUnmounted, watchEffect } from 'vue';
import type { CssOverridesProviderProps } from './CssOverridesProvider.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';

const props = defineProps<CssOverridesProviderProps>();
const { hostRef } = useHostElementProvider();

// A customer can pass one CSS string or a list of CSS strings.
// We turn that into one clean CSS block before injecting it.
const normalizedCssOverrides = computed(() => {
    if (!props.cssOverrides) {
        return '';
    }

    return Array.isArray(props.cssOverrides)
        ? props.cssOverrides.filter(Boolean).join('\n').trim()
        : props.cssOverrides.trim();
});

let styleElement: HTMLStyleElement | undefined;

// Remove our injected style tag when overrides are cleared or the SDK component unmounts.
const removeStyleElement = () => {
    styleElement?.remove();
    styleElement = undefined;
};

// Create the style tag once per shadow root and reuse it when the CSS changes.
const getStyleElement = (root: ShadowRoot) => {
    if (!styleElement || styleElement.getRootNode() !== root) {
        removeStyleElement();
        styleElement = document.createElement('style');
        styleElement.setAttribute('data-solvimon-css-overrides', '');
        root.appendChild(styleElement);
    }

    return styleElement;
};

watchEffect(() => {
    // The SDK UI lives inside the custom element's shadow root.
    // Customer CSS must be injected there, otherwise it cannot style our components.
    const root = hostRef.value?.shadowRoot;
    const css = normalizedCssOverrides.value;

    if (!root || !css) {
        removeStyleElement();
        return;
    }

    getStyleElement(root).textContent = css;
});

onUnmounted(removeStyleElement);
</script>

<template>
    <slot />
</template>
