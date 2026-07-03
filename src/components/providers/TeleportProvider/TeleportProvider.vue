<script setup lang="ts">
import { DropdownTeleportProvider, PortalProvider, TooltipTeleportProvider, SearchSelectInputTeleportProvider } from '@solvimon/solvimon-ui';
</script>

<template>
    <DropdownTeleportProvider>
        <PortalProvider name="modal">
            <TooltipTeleportProvider>
                <SearchSelectInputTeleportProvider>
                    <slot />
                </SearchSelectInputTeleportProvider>
            </TooltipTeleportProvider>
        </PortalProvider>
    </DropdownTeleportProvider>
</template>
