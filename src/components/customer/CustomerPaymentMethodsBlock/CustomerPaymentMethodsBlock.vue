<script setup lang="ts">
import { Section, Typography, Button, Chip, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type {
    CustomerPaymentMethodsBlockEmits,
    CustomerPaymentMethodsBlockProps,
} from './CustomerPaymentMethodsBlock.types';
import PaymentMethodsList from '@/components/payments/PaymentMethodsList/PaymentMethodsList.vue';

const props = defineProps<CustomerPaymentMethodsBlockProps>();
defineEmits<CustomerPaymentMethodsBlockEmits>();

const { $t } = useIntl();

const hasPaymentMethods = computed<boolean>(() => props.paymentMethods.length > 0);

/** Managing needs a method to manage or one to add; without either there is nothing to do. */
const isHeaderButtonShown = computed<boolean>(
    () =>
        props.showViewAllButton &&
        (!props.isManaged || hasPaymentMethods.value || !props.hasNoPaymentMethodOptions),
);
</script>

<template>
    <Section
        class="sv-payment-methods"
        no-spacing
        no-border
        content-background="none"
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
        <template v-if="isHeaderButtonShown" #right>
            <Button
                v-if="isManaged"
                size="xs"
                intent="subtle"
                class="sv-action sv-action--ghost sv-payment-methods__manage"
                type="button"
                @click="$emit('view-all-payment-methods')"
                >{{
                    $t({
                        defaultMessage: 'Manage',
                        id: 'customer_overview.payment_methods_block.manage_button_label',
                        description:
                            "Label of the button that opens the management of the customer's payment methods",
                    })
                }}</Button
            >
            <Button
                v-else
                size="xs"
                intent="subtle"
                icon-suffix="arrow_right_alt"
                class="sv-action sv-action--ghost sv-payment-methods__view-all"
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

        <template v-if="hasPaymentMethods">
            <PaymentMethodsList :payment-methods="paymentMethods" />
            <Button
                v-if="morePaymentMethodsCount"
                size="xs"
                intent="subtle"
                class="sv-action sv-action--ghost sv-payment-methods__show-more mt-2"
                type="button"
                @click="$emit('view-all-payment-methods')"
            >
                {{
                    $t({
                        defaultMessage: 'Show more',
                        id: 'customer_overview.payment_methods_block.show_more_button_label',
                        description:
                            'Label of the link below the payment methods block that opens the rest of them',
                    })
                }}
                <Chip
                    class="sv-payment-methods__show-more-count ml-1"
                    intent="neutral"
                    size="sm"
                    :content="String(morePaymentMethodsCount)"
                />
            </Button>
        </template>
        <Section v-else class="sv-empty-state sv-payment-methods__empty">
            <Typography
                :variant="hasNoPaymentMethodOptions ? 'body-xs' : 'body-sm'"
                color="subtle"
                no-spacing
                class="sv-payment-methods__empty-message"
                >{{
                    hasNoPaymentMethodOptions
                        ? $t({
                              defaultMessage: 'No online payment methods are available.',
                              description:
                                  'Shown on the customer overview when the customer has no payment methods and none can be added',
                              id: 'customer_overview.payment_methods_block.no_options_text',
                          })
                        : $t({
                              defaultMessage:
                                  'Add a payment method for recurring invoice payments.',
                              description:
                                  'Helper text for adding a payment method when no payment methods are configured',
                              id: 'customer_overview.payment_methods_block.add_payment_method_helper_text',
                          })
                }}</Typography
            >
            <Button
                v-if="showAddButton && !hasNoPaymentMethodOptions"
                class="sv-action sv-action--secondary sv-action--full-width sv-payment-methods__add mt-4 w-full"
                intent="secondary"
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
