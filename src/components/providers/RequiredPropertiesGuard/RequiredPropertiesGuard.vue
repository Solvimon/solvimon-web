<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<{
    /** Names of the required properties that have no value yet; empty renders the slot. */
    missing: string[];
}>();

const logger = useLogger();
let timer: ReturnType<typeof setTimeout> | undefined;

// A host may set properties after the element has mounted — right after `define()` upgrades it, or
// once its own data arrives — so only what is still missing a task later is reported, and the slot
// renders as soon as the last one is set.
onMounted(() => {
    timer = setTimeout(() => {
        if (!props.missing.length) return;

        logger.warn(
            'MISSING_REQUIRED_PROPERTIES',
            `Not rendering until these properties are set: ${props.missing.join(', ')}`,
            { missing: props.missing },
        );
    });
});

onUnmounted(() => clearTimeout(timer));
</script>

<template>
    <slot v-if="!missing.length" />
</template>
