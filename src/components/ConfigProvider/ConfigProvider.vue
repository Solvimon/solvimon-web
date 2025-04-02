<script setup lang="ts">
import { provide } from 'vue';
import { CONFIG_INJECTION_KEY } from './ConfigProvider.lib';
import { getConfig } from '../../config/lib';
import type { ConfigProviderProps } from './ConfigProvider.types';

const props = defineProps<ConfigProviderProps>();
const config = getConfig(props.environment);
provide(CONFIG_INJECTION_KEY, config);
</script>

<template>
    <slot />
</template>
