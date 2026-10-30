<script setup lang="ts">
import { computed, defineAsyncComponent, provide } from 'vue';
import { getAuth, AUTH_INJECTION_KEY } from './AuthProvider.lib';
import type { AuthProviderProps } from './AuthProvider.types';

// Every element loads AuthProvider, and only a link the API could not verify needs it.
const PortalLinkUnverified = defineAsyncComponent(
    () => import('@/components/shared/PortalLinkUnverified.vue'),
);

const props = defineProps<AuthProviderProps>();
const auth = getAuth(props.token, props.authentication, props.portalToken);

provide(AUTH_INJECTION_KEY, auth);

const ending = computed(() =>
    auth.status.value.state === 'ended' ? auth.status.value : undefined,
);
</script>

<template>
    <slot v-if="auth.accessToken.value" />
    <slot v-else-if="ending" name="ended" :ending="ending" />
    <PortalLinkUnverified
        v-else-if="auth.status.value.state === 'unavailable'"
        @retry="auth.retry"
    />
</template>
