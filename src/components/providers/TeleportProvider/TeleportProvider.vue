<script setup lang="ts">
import { TooltipTeleportProvider, SearchSelectInputTeleportProvider } from '@solvimon/ui';
</script>

<template>
    <TooltipTeleportProvider>
        <SearchSelectInputTeleportProvider>
            <slot />
        </SearchSelectInputTeleportProvider>
    </TooltipTeleportProvider>
</template>
