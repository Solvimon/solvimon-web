<script setup lang="ts">
import {
    formatWalletBalanceValue,
    InvoicePreview,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { TopUpModalSuccessProps } from './TopUpModalSuccess.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<TopUpModalSuccessProps>();

const { $t, formatNumber } = useIntl();

const title = computed(() =>
    $t({
        defaultMessage: 'Top-up successful',
        description: 'Title of the top-up modal once the top-up has been charged',
        id: 'topup_modal.success.title',
    }),
);

/** What was added, in the wallet's own terms — "1,000 coins" for credits, "€10.00" for money. */
const addedLabel = computed(() =>
    props.addedValue
        ? $t(
              {
                  // Phrased around the value rather than agreeing with it: "1,000 coins was added"
                  // would be wrong, and the value arrives already formatted, so it cannot pluralise.
                  defaultMessage:
                      'Your balance was topped up with {value}. Please be aware that it can take some time to reflect this change in your wallet.',
                  description:
                      'Confirmation of what a completed top-up added to the wallet balance',
                  id: 'topup_modal.success.added',
              },
              { value: formatWalletBalanceValue($t, formatNumber, props.addedValue) },
          )
        : undefined,
);
</script>

<template>
    <div class="sv-top-up-success grid grid-cols-1 gap-4">
        <PaymentFeedbackCard status="success" :title="title">
            <span v-if="addedLabel" class="sv-top-up-success__added">{{ addedLabel }}</span>
        </PaymentFeedbackCard>

        <!-- receipt -->
        <Section v-if="invoice" content-background="none">
            <Typography tag="span" variant="body-sm" weight="semibold" class="mb-2 block">{{
                $t({
                    defaultMessage: 'Receipt',
                    description: 'Heading above the invoice a completed top-up produced',
                    id: 'topup_modal.success.receipt.heading',
                })
            }}</Typography>
            <InvoicePreview :invoice="invoice" is-customer-facing />
        </Section>
    </div>
</template>
