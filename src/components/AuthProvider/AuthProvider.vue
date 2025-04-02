<script setup lang="ts">
import { provide } from 'vue';
import { getAuth, AUTH_INJECTION_KEY } from './AuthProvider.lib';
import type { AuthProviderProps } from './AuthProvider.types';

const props = defineProps<AuthProviderProps>();
const auth = getAuth(props.token);
provide(AUTH_INJECTION_KEY, auth);
</script>

<template>
    <slot v-if="auth.accessToken.value" />
</template>
