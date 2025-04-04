<script setup lang="ts">
import {usePortal} from '@/components/PortalProvider/composables/usePortal';
import { getPortal, PORTAL_INJECTION_KEY } from '@/components/PortalProvider/PortalProvider.lib';
import type { PortalProviderProps } from './PortalProvider.types';
import { onMounted, provide, ref } from 'vue';

const props = defineProps<PortalProviderProps>();

const portal = getPortal(props.token)
provide(PORTAL_INJECTION_KEY, portal)
</script>

<template>
    <slot v-if="portal?.id" />
</template>