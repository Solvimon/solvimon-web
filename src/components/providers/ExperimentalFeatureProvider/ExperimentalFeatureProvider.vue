<script setup lang="ts">
import { provide } from 'vue';
import {
    EXPERIMENTAL_FEATURE_INJECTION_KEY,
    getExperimentalFeatures,
} from './ExperimentalFeatureProvider.lib';
import type { ExperimentalFeatureProviderProps } from './ExperimentalFeatureProvider.types';

const props = defineProps<ExperimentalFeatureProviderProps>();
const experimentalFeatures = getExperimentalFeatures(props.experimentalFeatures);

provide(EXPERIMENTAL_FEATURE_INJECTION_KEY, experimentalFeatures);
</script>

<template>
    <slot />
</template>
