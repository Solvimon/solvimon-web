<script setup lang="ts">
import { Button, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentErrorCardProps } from './PaymentErrorCard.types';
import { ErrorMap } from './PaymentErrorCard.lib';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<PaymentErrorCardProps>();

const { $t } = useIntl();

const errorConfig = computed(() => ErrorMap[props.error.code]);

const reload = () => {
    window.location.reload();
};
</script>

<template>
    <PaymentFeedbackCard status="error" :title="errorConfig.title">
        <div class="flex flex-col items-center gap-6">
            <Typography variant="body-xs" shade="lighter" class="mt-3">{{
                errorConfig.message
            }}</Typography>
            <Button
                v-if="errorConfig.isReloadButtonVisible"
                type="button"
                color="gray"
                variant="outline"
                @click="reload"
            >
                {{
                    $t({
                        defaultMessage: 'Try again',
                        description:
                            'Retry button text when an error has happened during a payment',
                        id: 'payments.retry_button.label',
                    })
                }}
            </Button>
        </div>
    </PaymentFeedbackCard>
</template>
