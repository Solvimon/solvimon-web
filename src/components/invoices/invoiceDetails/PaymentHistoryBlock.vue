<script setup lang="ts">
import {
    Typography,
    formatEnum,
    Chip,
    type ChipColor,
    PaymentMethod,
    useIntl,
    Section,
} from '@solvimon/ui';
import type { Customer, Payment } from '@solvimon/types';

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
    <div>
        <Typography tag="h2" variant="heading-3">{{
            $t({
                defaultMessage: 'Payment history',
                description: 'Title for the payment history block on the invoice details page',
                id: 'sdk.invoice_details.payment_history.title',
            })
        }}</Typography>
        <div class="flex flex-col-reverse gap-1">
            <Section
                v-for="paymentAttempt in paymentAttempts"
                :key="paymentAttempt.id"
                class="mt-1 md:mt-2"
            >
                <div class="flex justify-between items-center mb-2">
                    <Typography variant="caps-heading"
                        >{{
                            $t({
                                defaultMessage: 'Payment attempt',
                                description: 'Title for the payment attempt block',
                                id: 'sdk.invoice_details.payment_history.payment_attempt',
                            })
                        }}
                    </Typography>
                    <Chip :color="colorMapping[paymentAttempt.result]">{{
                        formatEnum(paymentAttempt.result)
                    }}</Chip>
                </div>

                <PaymentMethod
                    v-if="paymentAttempt.payment_method_details"
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
