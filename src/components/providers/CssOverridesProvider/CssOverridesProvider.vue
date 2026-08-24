<script setup lang="ts">
import { computed, onUnmounted, watchEffect } from 'vue';
import type { CssOverridesProviderProps } from './CssOverridesProvider.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';
import {
    adoptStyleSheet,
    createStyleSheet,
    releaseStyleSheet,
    supportsConstructedStyleSheets,
} from '@/utils/styleSheets';

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
let styleSheet: CSSStyleSheet | undefined;
let styleSheetRoot: ShadowRoot | undefined;

// Remove our injected CSS when overrides are cleared or the SDK component unmounts.
const removeStyles = () => {
    styleElement?.remove();
    styleElement = undefined;

    if (styleSheet && styleSheetRoot) {
        releaseStyleSheet(styleSheetRoot, styleSheet);
    }

    styleSheet = undefined;
    styleSheetRoot = undefined;
};

/**
 * The customer's own sheet, adopted after the base ones the element adopted while constructing. That
 * order is what makes an override an override: adopted sheets cascade in the order they arrive, so a
 * sheet adopted later wins against the SDK's own rules at equal specificity.
 */
const applyStyleSheet = (root: ShadowRoot, css: string) => {
    if (!styleSheet || styleSheetRoot !== root) {
        removeStyles();
        styleSheet = createStyleSheet(css);
        styleSheetRoot = root;
        adoptStyleSheet(root, styleSheet);

        return;
    }

    styleSheet.replaceSync(css);
};

// Create the style tag once per shadow root and reuse it when the CSS changes. Used where a browser
// cannot adopt a stylesheet; appending puts it after the base `<style>` elements, which is the same
// order the adopted route relies on.
const applyStyleElement = (root: ShadowRoot, css: string) => {
    if (!styleElement || styleElement.getRootNode() !== root) {
        removeStyles();
        styleElement = document.createElement('style');
        styleElement.setAttribute('data-solvimon-css-overrides', '');
        root.appendChild(styleElement);
    }

    styleElement.textContent = css;
};

watchEffect(() => {
    // The SDK UI lives inside the custom element's shadow root.
    // Customer CSS must be injected there, otherwise it cannot style our components.
    const root = hostRef.value?.shadowRoot;
    const css = normalizedCssOverrides.value;

    if (!root || !css) {
        removeStyles();
        return;
    }

    if (supportsConstructedStyleSheets) {
        applyStyleSheet(root, css);
        return;
    }

    applyStyleElement(root, css);
});

onUnmounted(removeStyles);
</script>

<template>
    <slot />
</template>
