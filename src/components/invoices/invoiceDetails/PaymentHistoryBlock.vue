<script setup lang="ts">
import {
    Typography,
    formatEnum,
    Chip,
    type ChipColor,
    PaymentMethod,
    useIntl,
    Section,
} from '@solvimon/solvimon-ui';
import type { Customer, Payment } from '@solvimon/solvimon-types';

const { $t, formatDate } = useIntl();

defineProps<{
    paymentAttempts: Payment[];
    customer: Customer;
}>();

const colorMapping: Record<Payment['result'], ChipColor> = {
    AUTHORIZED: 'green',
    CANCELLED: 'red',
    ERROR: 'red',
    PENDING: 'orange',
    PENDING_REFUND: 'orange',
    REFUNDED: 'orange',
    CHARGED_BACK: 'orange',
    REFUSED: 'red',
};
</script>

<template>
    <div class="sv-payment-history">
        <Typography tag="h2" variant="heading-3" class="sv-payment-history__title">{{
            $t({
                defaultMessage: 'Payment history',
                description: 'Title for the payment history block on the invoice details page',
                id: 'sdk.invoice_details.payment_history.title',
            })
        }}</Typography>
        <div class="sv-payment-history__items flex flex-col-reverse gap-1">
            <Section
                v-for="paymentAttempt in paymentAttempts"
                :key="paymentAttempt.id"
                class="sv-payment-history__item mt-1 md:mt-2"
            >
                <div class="sv-payment-history__item-header mb-2 flex items-center justify-between">
                    <Typography variant="caps-heading" class="sv-payment-history__item-title"
                        >{{
                            $t({
                                defaultMessage: 'Payment attempt',
                                description: 'Title for the payment attempt block',
                                id: 'sdk.invoice_details.payment_history.payment_attempt',
                            })
                        }}
                    </Typography>
                    <Chip class="sv-payment-history__item-status" :color="colorMapping[paymentAttempt.result]">{{
                        formatEnum(paymentAttempt.result)
                    }}</Chip>
                </div>

                <PaymentMethod
                    v-if="paymentAttempt.payment_method_details"
                    class="sv-payment-history__payment-method"
                    :payment-method="paymentAttempt.payment_method_details"
                >
                    <template #description>
                        {{
                            formatDate({
                                date: paymentAttempt.created_at,
                                format: 'dateTime',
                                offsetType: 'offsetted',
                                timezone: customer.timezone,
                            })
                        }}
                    </template>
                </PaymentMethod>
            </Section>
        </div>
    </div>
</template>
