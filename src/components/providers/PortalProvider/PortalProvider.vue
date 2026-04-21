<script setup lang="ts">
import { provide, toRef } from 'vue';
import type { PortalProviderProps } from './PortalProvider.types';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';

const props = defineProps<PortalProviderProps>();

provide(PORTAL_INJECTION_KEY, toRef(props.portalObject));
</script>

<template>
    <slot v-if="portalObject" />
</template>
