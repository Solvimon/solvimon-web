<script setup lang="ts">
import { InvoicePreview, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { TopUpModalSuccessProps } from './TopUpModalSuccess.types';

defineProps<TopUpModalSuccessProps>();

const { $t } = useIntl();
</script>

<template>
    <div class="sv-top-up-success grid grid-cols-1 gap-4">
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
