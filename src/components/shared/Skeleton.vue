<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { isVnodeEmpty } from '@solvimon/solvimon-ui';
import type { SkeletonProps } from './Skeleton.types';

defineProps<SkeletonProps>();
const slots = useSlots();

const hasSlotContent = computed(() => !isVnodeEmpty(slots.default?.({}) ?? []));
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
