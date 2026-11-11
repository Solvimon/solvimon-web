<script setup lang="ts">
import { defineAsyncComponent, provide } from 'vue';
import { getAuth, AUTH_INJECTION_KEY } from './AuthProvider.lib';
import type { AuthProviderProps } from './AuthProvider.types';

// Every element loads AuthProvider, and only a link the API could not verify needs it.
const PortalLinkUnverified = defineAsyncComponent(
    () => import('@/components/shared/PortalLinkUnverified.vue'),
);

const props = defineProps<AuthProviderProps>();
const auth = getAuth(props.token, props.authentication, props.portalToken);

provide(AUTH_INJECTION_KEY, auth);
</script>

<template>
    <slot v-if="auth.accessToken.value" />
    <!-- A link the API refused is as unusable as one that has ended, and is shown the same way. -->
    <slot
        v-else-if="auth.status.value.state === 'ended' || auth.status.value.state === 'invalid'"
        name="ended"
    />
    <PortalLinkUnverified
        v-else-if="auth.status.value.state === 'unavailable'"
        @retry="auth.retry"
    />
</template>
