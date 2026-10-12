<script setup lang="ts">
import { computed } from 'vue';
import { Alert, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { TaxIdValidationStatus } from '@solvimon/solvimon-types';

const props = defineProps<{
    status: TaxIdValidationStatus;
}>();

const { formatMessage } = useIntl();

const alertType = computed<'success' | 'danger' | 'neutral'>(() => {
    switch (props.status) {
        case 'VALID':
            return 'success';
        case 'NOT_VALID':
            return 'danger';
        default:
            return 'neutral';
    }
});

const taxIdValidationMessage = computed(() => {
    switch (props.status) {
        case 'VALID':
            return formatMessage({
                defaultMessage: 'VAT number is valid.',
                id: 'tax_check.valid_vat_number',
                description: 'The message shown when the VAT number is valid',
            });
        case 'NOT_VALID':
            return formatMessage({
                defaultMessage: 'VAT number is invalid.',
                id: 'tax_check.invalid_vat_number',
                description: 'The message shown when the VAT number is invalid',
            });
        default:
            return formatMessage({
                defaultMessage: 'The VAT number could not be checked right now.',
                id: 'tax_check.unknown_vat_number',
                description:
                    'The message shown when the VAT number check could not give an answer, for instance because the EU VAT service is unavailable',
            });
    }
});
</script>

<template>
    <Alert :type="alertType" :icon="false">
        <div class="flex items-center gap-2">
            <Typography variant="body-xs">
                {{ taxIdValidationMessage }}
            </Typography>
        </div>
    </Alert>
</template>
