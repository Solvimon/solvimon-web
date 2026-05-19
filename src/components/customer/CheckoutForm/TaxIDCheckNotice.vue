<script setup lang="ts">
import { computed } from 'vue';
import { Alert, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { TaxIdValidationResult } from '@solvimon/solvimon-types';

const props = defineProps<{
    taxIdValidationResult: TaxIdValidationResult;
}>();

const { formatMessage } = useIntl();

const isTaxIdValid = computed(() => {
    return props.taxIdValidationResult.valid === 'VALID';
});

const taxIdValidationMessage = computed(() => {
    return isTaxIdValid.value
        ? formatMessage({
              defaultMessage: 'VAT number is valid.',
              id: 'tax_check.valid_vat_number',
              description: 'The message shown when the VAT number is valid',
          })
        : formatMessage({
              defaultMessage: 'VAT number is invalid.',
              id: 'tax_check.invalid_vat_number',
              description: 'The message shown when the VAT number is invalid',
          });
});
</script>

<template>
    <Alert :type="isTaxIdValid ? 'success' : 'danger'" :icon="false">
        <div class="flex items-center gap-2">
            <Typography variant="body-xs">
                {{ taxIdValidationMessage }}
            </Typography>
        </div>
    </Alert>
</template>
