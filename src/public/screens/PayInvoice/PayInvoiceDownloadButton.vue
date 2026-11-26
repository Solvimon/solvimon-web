<script setup lang="ts">
import { Button, useIntl } from '@solvimon/solvimon-ui';

const emit = defineEmits<{ click: [] }>();

const { $t } = useIntl();
</script>

<template>
    <Button type="button" intent="secondary" @click="emit('click')">
        {{
            $t({
                defaultMessage: 'Download invoice',
                description: 'Button that downloads the invoice when it cannot be paid online',
                id: 'pay_invoice.unavailable.download_invoice',
            })
        }}
    </Button>
</template>
