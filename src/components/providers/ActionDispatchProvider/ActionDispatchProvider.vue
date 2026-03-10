<script setup lang="ts">
import { provide } from 'vue';
import {
    ACTION_DISPATCHER_PROVIDER_INJECTION_KEY,
    createActionDispatcher,
} from './ActionDispatchProvider.lib';

const actionDispatcher = createActionDispatcher();

provide(ACTION_DISPATCHER_PROVIDER_INJECTION_KEY, actionDispatcher);
</script>

<template>
    <slot />
</template>
