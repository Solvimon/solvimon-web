<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/solvimon-ui';

const { $t } = useIntl();
</script>

<template>
    <Typography
        tag="p"
        variant="body-xs"
        color="subtle"
        class="sv-sepa-mandate mt-2"
        data-testid="sepa-mandate-notice"
    >
        {{
            $t({
                defaultMessage:
                    'By providing your IBAN you authorise us to send instructions to your bank to debit your account, and your bank to debit your account in accordance with those instructions.',
                description:
                    'SEPA direct debit mandate authorisation, shown inside the SEPA payment method form',
                id: 'payments.sepa_mandate.notice',
            })
        }}
    </Typography>
</template>
