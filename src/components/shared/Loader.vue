<script setup lang="ts">
import { Spinner } from '@solvimon/solvimon-ui';
import type { LoaderProps } from './Loader.types';

withDefaults(defineProps<LoaderProps>(), { size: '4', withSpacing: false });
</script>

<template>
    <div :class="['flex h-[88px] items-center justify-center', { 'p-3 pt-2': withSpacing }]">
        <Spinner :size="size" />
    </div>
</template>
