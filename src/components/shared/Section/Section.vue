<script setup lang="ts">
import { computed } from 'vue';
import { Section } from '@solvimon/solvimon-ui';
import type { SectionProps } from './Section.types';

const props = withDefaults(defineProps<SectionProps>(), { emphasized: false });

const ACCENT = [
    'sv-section__accent relative',
    'before:absolute before:inset-y-0.5 before:left-0.5 before:w-0.5',
    'before:rounded-full before:bg-primary-600',
].join(' ');

const contentClasses = computed(() =>
    [props.emphasized ? ACCENT : undefined, props.contentClasses].filter(Boolean).join(' '),
);

const sectionProps = computed(() => {
    const { emphasized: _emphasized, ...rest } = props;

    return rest;
});
</script>

<template>
    <Section v-bind="sectionProps" class="sv-section" :content-classes="contentClasses">
        <template v-if="$slots.right" #right><slot name="right" /></template>
        <slot />
    </Section>
</template>
