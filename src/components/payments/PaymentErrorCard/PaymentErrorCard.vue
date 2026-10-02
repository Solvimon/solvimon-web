<script setup lang="ts">
import { Button, IconButton, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentErrorCardProps } from './PaymentErrorCard.types';
import { createErrorMap } from './PaymentErrorCard.lib';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';
import { useCopyToClipboard } from '@/composables/useCopyToClipboard';

const props = defineProps<PaymentErrorCardProps>();

const { $t } = useIntl();
const { copy, hasCopied } = useCopyToClipboard();

const errorConfig = computed(() => createErrorMap($t)[props.error.code]);

const reload = () => {
    window.location.reload();
};

const copyLabel = computed(() =>
    $t({
        defaultMessage: 'Copy reference',
        description: 'Label of the button that copies the payment error reference',
        id: 'payments.error_card.reference.copy.label',
    }),
);

const copiedLabel = computed(() =>
    $t({
        defaultMessage: 'Copied',
        description: 'Confirmation shown after copying the payment error reference',
        id: 'payments.error_card.reference.copied.label',
    }),
);

const copyReference = () => {
    if (!props.error.reference) return;
    // Nothing to do when the copy fails: the reference is on screen and can be read off it.
    void copy(props.error.reference);
};
</script>

<template>
    <PaymentFeedbackCard status="error" :title="errorConfig.title">
        <div class="flex flex-col items-center gap-6">
            <Typography variant="body-xs" color="subtle" class="mt-3">{{
                errorConfig.message
            }}</Typography>
            <Button
                v-if="errorConfig.isReloadButtonVisible"
                type="button"
                intent="secondary"
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
            <!--
                The reference is what turns "a payment failed" into a support request we can act
                on, so it is shown whenever one is present rather than hidden behind a details
                toggle. It identifies the browser session only — no customer, no account.
            -->
            <div v-if="error.reference" class="flex flex-col items-center gap-1">
                <Typography variant="body-xs" color="subtle">
                    {{
                        $t({
                            defaultMessage:
                                'Share this reference with support if the problem continues',
                            description:
                                'Explains what the reference below a failed payment is for',
                            id: 'payments.error_card.reference.description',
                        })
                    }}
                </Typography>
                <div class="flex items-center gap-1">
                    <Typography
                        variant="body-xs"
                        tag="span"
                        class="select-all font-mono"
                        data-testid="payment-error-reference"
                    >
                        {{ error.reference }}
                    </Typography>
                    <IconButton
                        type="button"
                        intent="subtle"
                        size="sm"
                        :icon="hasCopied ? 'check' : 'content_copy'"
                        :aria-label="copyLabel"
                        :tooltip="hasCopied ? copiedLabel : copyLabel"
                        @click="copyReference"
                    />
                </div>
            </div>
        </div>
    </PaymentFeedbackCard>
</template>
