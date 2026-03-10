<script setup lang="ts">
import { Section, Typography, Button, PaymentMethod, useIntl } from '@solvimon/ui';
import { computed } from 'vue';
import type {
    CustomerPaymentMethodsBlockEmits,
    CustomerPaymentMethodsBlockProps,
} from './CustomerPaymentMethodsBlock.types';

const props = withDefaults(defineProps<CustomerPaymentMethodsBlockProps>(), {
    limit: 2,
    configuration: () => ({
        showViewAllButton: true,
        showAddButton: true,
    }),
});
defineEmits<CustomerPaymentMethodsBlockEmits>();

const { $t } = useIntl();

const hasPaymentMethods = computed<boolean>(() => props.paymentMethods.length > 0);
</script>

<template>
    <Section
        no-spacing
        no-border
        :title="
            $t(
                {
                    defaultMessage: '{count, plural, one {Payment method} other {Payment methods}}',
                    description:
                        'Title for the payment methods block on the customer overview page',
                    id: 'customer_overview.payment_methods.title',
                },
                { count: String(paymentMethods.length) },
            )
        "
    >
        <template #right>
            <Button
                size="sm"
                variant="ghost"
                color="gray"
                icon-suffix="arrow_right_alt"
                type="button"
                @click="$emit('view-all-payment-methods')"
                >{{
                    $t({
                        defaultMessage: 'View all',
                        id: 'customer_overview.payment_methods_block.view_all_payment_methods_link_label',
                        description:
                            'The link text that links to the overview page of the customer invoices',
                    })
                }}</Button
            >
        </template>

        <div v-if="hasPaymentMethods" class="flex flex-col gap-2">
            <Section v-for="paymentMethod in paymentMethods" :key="paymentMethod.id">
                <PaymentMethod :payment-method="paymentMethod" />
            </Section>
        </div>
        <Section v-else>
            <Typography variant="body-sm" shade="lighter" no-spacing>{{
                $t({
                    defaultMessage: 'Add a payment method for recurring invoice payments.',
                    description:
                        'Helper text for adding a payment method when no payment methods are configured',
                    id: 'customer_overview.payment_methods_block.add_payment_method_helper_text',
                })
            }}</Typography>
            <Button
                v-if="showAddButton"
                class="mt-4 w-full"
                variant="outline"
                color="gray"
                icon-prefix="add"
                type="button"
                @click="$emit('add-payment-method')"
            >
                {{
                    $t({
                        defaultMessage: 'Add payment method',
                        description:
                            'Text for the add payment method button that is shown when no payment methods have been configured',
                        id: 'customer_overview.payment_methods_block.add_payment_method_button_label',
                    })
                }}
            </Button>
        </Section>
    </Section>
</template>
