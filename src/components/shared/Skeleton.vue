<script setup lang="ts">
import { computed, useSlots, Comment, Fragment, Text, isVNode } from 'vue';
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

    if (!isVNode(node)) return false;

    const vnode = node;

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

    const vnodes = slots.default({});
    if (!vnodes || vnodes.length === 0) return false;

    // Slot has content if at least one vnode is not empty
    return !vnodes.every(isVnodeEmpty);
});
</script>

<template>
    <slot v-if="hasSlotContent" name="default" />
    <template v-else>
        <template v-if="variant === 'title'">
            <div
                v-bind="$attrs"
                :data-testid="dataTestid"
                class="sv-skeleton sv-skeleton--title h-6 w-40 rounded border border-gray-50 bg-gray-50/50"
            />
        </template>
        <template v-else-if="variant === 'divider-text'">
            <div
                v-bind="$attrs"
                :data-testid="dataTestid"
                class="sv-skeleton sv-skeleton--divider-text mx-auto h-4 w-12 rounded border border-gray-50 bg-gray-50/50"
            />
        </template>
        <template v-else-if="variant === 'section'">
            <div v-bind="$attrs" :data-testid="dataTestid" class="sv-skeleton sv-skeleton--section">
                <div
                    class="sv-skeleton__title h-6 w-40 rounded border border-gray-50 bg-gray-50/50"
                />
                <div
                    :class="[
                        'sv-skeleton__body mt-1 rounded border border-gray-50 bg-gray-50/50 md:mt-2',
                        $props.class,
                    ]"
                />
            </div>
        </template>
        <div
            v-else
            v-bind="$attrs"
            :data-testid="dataTestid"
            :class="['sv-skeleton rounded border border-gray-50 bg-gray-50/50', $props.class]"
        />
    </template>
</template>
