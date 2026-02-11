<script setup lang="ts">
import { provide, toRef } from 'vue';
import type { PortalProviderProps } from './PortalProvider.types';
import {
    getPortal,
    PORTAL_INJECTION_KEY,
} from '@/components/providers/PortalProvider/PortalProvider.lib';

const props = defineProps<PortalProviderProps>();

const portal =
    props.portalObject === undefined && props.token
        ? getPortal({ token: props.token, allowedPortalTypes: props.allowedPortalTypes })
        : toRef(props.portalObject);

provide(PORTAL_INJECTION_KEY, portal);
</script>

<template>
    <slot v-if="portal?.id" />
</template>
