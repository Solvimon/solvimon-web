<script setup lang="ts">
import { ref } from 'vue';
import { Typography, Button, useIntl } from '@solvimon/solvimon-ui';

import type { ErrorStateProps, ErrorStateEmits } from './ErrorState.types';

withDefaults(defineProps<ErrorStateProps>(), {
    showRetry: false,
    withSpacing: false,
});

const emit = defineEmits<ErrorStateEmits>();
const { $t } = useIntl();

const isThrottled = ref<boolean>(false);

const handleRetry = (): void => {
    if (isThrottled.value) return;
    isThrottled.value = true;
    emit('retry');

    setTimeout(() => {
        isThrottled.value = false;
    }, 1000);
};
</script>

<template>
    <div :class="['flex flex-col gap-1 items-center text-center', { 'p-3 pt-2': withSpacing }]">
        <Typography variant="body-xs" shade="light" weight="semibold">
            {{ title }}
        </Typography>

        <Typography v-if="subtitle" variant="body-xs" shade="lighter">
            {{ subtitle }}
        </Typography>

        <div>
            <Button
                v-if="showRetry"
                size="sm"
                variant="ghost"
                icon-prefix="refresh"
                :disabled="isThrottled"
                @click="handleRetry"
            >
                {{
                    $t({
                        defaultMessage: 'Refresh',
                        description:
                            'Label of the button in the error state that lets you retry your action',
                        id: 'empty_state.retry.button',
                    })
                }}
            </Button>
        </div>
    </div>
</template>
