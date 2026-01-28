<script setup lang="ts">
import { Typography } from '@solvimon/ui';
</script>

<template>
    <div class="flex gap-4 border-l-2 border-gray-200 px-2">
        <div class="grow">
            <Typography tag="span" variant="body-sm" weight="semibold"
                ><slot name="title"
            /></Typography>
        </div>
        <div>
            <Typography tag="span" variant="body-xs" shade="lighter"
                ><slot name="description"
            /></Typography>
        </div>
    </div>
</template>
