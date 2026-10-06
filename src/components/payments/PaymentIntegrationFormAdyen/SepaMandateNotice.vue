<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';

const props = defineProps<{ billingEntityName?: string }>();

const { $t } = useIntl();

const title = computed(() =>
    $t({
        defaultMessage: 'SEPA Direct Debit mandate — recurring payments',
        description: 'Title of the SEPA direct debit mandate shown inside the SEPA payment form',
        id: 'payments.sepa_mandate.title',
    }),
);

/**
 * Named and unnamed wordings rather than an empty placeholder: a mandate that reads "you authorise
 * to instruct your bank" is worse than one that does not name the creditor at all. Same split as
 * `PaymentMethodsUnavailableCard` uses for the seller.
 */
const authorisation = computed(() =>
    props.billingEntityName
        ? $t(
              {
                  defaultMessage:
                      'By confirming this mandate, you authorise {billingEntityName} to instruct your bank to collect payments from your account, and you authorise your bank to carry out those instructions.',
                  description: 'SEPA direct debit mandate authorisation, naming the billing entity',
                  id: 'payments.sepa_mandate.authorisation',
              },
              { billingEntityName: props.billingEntityName },
          )
        : $t({
              defaultMessage:
                  'By confirming this mandate, you authorise us to instruct your bank to collect payments from your account, and you authorise your bank to carry out those instructions.',
              description:
                  'SEPA direct debit mandate authorisation, where the billing entity is not known',
              id: 'payments.sepa_mandate.authorisation_unnamed',
          }),
);

const recurrence = computed(() =>
    props.billingEntityName
        ? $t(
              {
                  defaultMessage:
                      'This bank account will be used automatically to pay subsequent invoices from {billingEntityName} until you cancel this mandate.',
                  description:
                      'Explains that the SEPA mandate covers later invoices, naming the billing entity',
                  id: 'payments.sepa_mandate.recurrence',
              },
              { billingEntityName: props.billingEntityName },
          )
        : $t({
              defaultMessage:
                  'This bank account will be used automatically to pay subsequent invoices until you cancel this mandate.',
              description:
                  'Explains that the SEPA mandate covers later invoices, where the billing entity is not known',
              id: 'payments.sepa_mandate.recurrence_unnamed',
          }),
);

/**
 * No billing entity in this one: the refund right is held against the payer's own bank, not the
 * creditor, so there is nothing here to name.
 */
const refundRights = computed(() =>
    $t({
        defaultMessage:
            "As part of your rights, you're entitled to a refund from your bank under the terms and conditions of your agreement with your bank. You must claim a refund within 8 weeks from the date your account was debited. You can request a statement from your bank explaining your rights.",
        description: "SEPA direct debit mandate refund rights, held against the payer's own bank",
        id: 'payments.sepa_mandate.refund_rights',
    }),
);
</script>

<template>
    <div class="sv-sepa-mandate mt-3" data-testid="sepa-mandate-notice">
        <Typography tag="p" variant="body-xs" class="font-semibold">{{ title }}</Typography>
        <!-- One paragraph: sentences of the same mandate, not separate statements. -->
        <Typography tag="p" variant="body-xs" color="subtle">
            {{ authorisation }} {{ recurrence }} {{ refundRights }}
        </Typography>
    </div>
</template>
