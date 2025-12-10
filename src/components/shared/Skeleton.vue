<script setup lang="ts">
import { computed, useSlots, Comment, Fragment, Text, type VNode } from 'vue';
import type { SkeletonProps } from './Skeleton.types';

defineProps<SkeletonProps>();
const slots = useSlots();

/**
 * Helper function to check if a vnode is empty (comments,
 * whitespace-only text, or empty fragments)
 */
const isVnodeEmpty = (node: unknown): boolean => {
    if (node == null || node === false) return true;

    // Handle plain strings/numbers
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node).trim().length === 0;
    }

    // Handle arrays
    if (Array.isArray(node)) {
        return node.every(isVnodeEmpty);
    }

    // Must be a VNode at this point
    const vnode = node as VNode;

    // Comment nodes are empty
    if (vnode.type === Comment) {
        return true;
    }

    // Text nodes with only whitespace are empty
    if (vnode.type === Text) {
        if (typeof vnode.children === 'string') {
            return !vnode.children.trim();
        }
        return true;
    }

    // Fragments are empty if all their children are empty
    if (vnode.type === Fragment) {
        if (vnode.children == null) return true;
        if (Array.isArray(vnode.children)) {
            return vnode.children.every(isVnodeEmpty);
        }
        // If children is not an array, it might be RawSlots or other types - treat as content
        return false;
    }

    // All other nodes (elements, components) are considered content
    return false;
};

const hasSlotContent = computed(() => {
    if (!slots.default) return false;

    const vnodes = slots.default();
    if (!vnodes || vnodes.length === 0) return false;

    // Slot has content if at least one vnode is not empty
    return !vnodes.every(isVnodeEmpty);
});
</script>

<template>
    <slot name="default" v-if="hasSlotContent" />
    <template v-else>
        <template v-if="variant === 'section'">
            <div>
                <div class="rounded border border-gray-50 bg-gray-50/50 h-6 w-40" />
                <div class="rounded border border-gray-50 bg-gray-50/50 mt-1 md:mt-2" />
            </div>
        </template>
        <div v-else class="rounded border border-gray-50 bg-gray-50/50" />
    </template>
</template>
