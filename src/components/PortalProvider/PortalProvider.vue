<script setup lang="ts">
import { provide } from 'vue';
import type { PortalProviderProps } from './PortalProvider.types';
import { getPortal, PORTAL_INJECTION_KEY } from '@/components/PortalProvider/PortalProvider.lib';

const props = defineProps<PortalProviderProps>();

const portal = getPortal(props.token);
provide(PORTAL_INJECTION_KEY, portal);
</script>

<template>
    <slot v-if="portal?.id" />
</template>
