<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { PlaceholderProps } from './Placeholder.types';

const MARKER = 'data-placeholder-style';

withDefaults(defineProps<PlaceholderProps>(), { animated: false, contentReady: false });

const elementRef = ref();

onMounted(() => {
    const root = elementRef.value?.getRootNode();
    if (root instanceof ShadowRoot) {
        // Prevent duplicate injection
        const existing = root.querySelector(`style[${MARKER}]`);
        if (existing) return;

        const style = document.createElement('style');
        style.setAttribute(MARKER, 'true');
        style.textContent = `
            .animated-gradient {
                background: linear-gradient(
                to right,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.9) 15%,
                rgba(255, 255, 255, 0) 40%
                );
                width: 100%;
                height: 100%;
                background-size: 200% auto;
                background-position: 0 100%;
                animation: placeholder-gradient-animation 1.7s infinite linear forwards;
            }

            @keyframes placeholder-gradient-animation {
                0% { background-position: 0 0; }
                100% { background-position: -200% 0; }
            }
        `;

        root.appendChild(style);
    }
});
</script>

<template>
    <div class="relative min-h-4">
        <div
            v-if="!contentReady"
            ref="elementRef"
            :class="[
                `pointer-events-none absolute inset-0 rounded bg-gray-100 ${placeholderClass ?? ''}`,
                { 'animated-gradient': animated },
            ]"
        />
        <slot v-if="contentReady" />
    </div>
</template>
