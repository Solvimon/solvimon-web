<script setup lang="ts">
import { provide, ref, type Ref } from 'vue';
import type { PortalProviderProps } from './PortalProvider.types';
import {
    getPortal,
    PORTAL_INJECTION_KEY,
} from '@/components/providers/PortalProvider/PortalProvider.lib';
import type { PortalUrl } from '@/services/portals.types';

const props = defineProps<PortalProviderProps>();

const portal = ref<PortalUrl | undefined>(props.portalObject);

if (!portal.value && props.token) {
    portal.value = getPortal({
        token: props.token,
        allowedPortalTypes: props.allowedPortalTypes,
    }).value;
}

provide(PORTAL_INJECTION_KEY, portal);
</script>

<template>
    <slot v-if="portal?.id" />
</template>
