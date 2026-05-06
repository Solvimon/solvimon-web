<script setup lang="ts">
import { computed } from 'vue';
import { Alert, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { TaxIdValidationResult } from '@solvimon/solvimon-types';

const props = defineProps<{
    taxIdValidationResult: TaxIdValidationResult;
}>();

const { formatMessage, formatDate } = useIntl();

const isTaxIdValid = computed(() => {
    return props.taxIdValidationResult.valid === 'VALID';
});

const taxIdValidationDate = computed(() => {
    return formatDate({
        date: props.taxIdValidationResult?.validation_date || '',
        offsetType: 'local',
        format: 'date',
    });
});

const taxIdValidationMessage = computed(() => {
    return isTaxIdValid.value
        ? formatMessage({
              defaultMessage: 'VAT number is valid.',
              id: 'damFt1',
              description: 'The message shown when the VAT number is valid',
          })
        : formatMessage({
              defaultMessage: 'VAT number is invalid.',
              id: 'gR9xe+',
              description: 'The message shown when the VAT number is invalid',
          });
});
</script>

<template>
    <Alert :type="isTaxIdValid ? 'success' : 'danger'" :icon="false">
        <div class="flex items-center gap-2">
            <Typography variant="body-xs">
                {{ `${taxIdValidationMessage} ${taxIdValidationDate}` }}
            </Typography>
        </div>
    </Alert>
</template>
