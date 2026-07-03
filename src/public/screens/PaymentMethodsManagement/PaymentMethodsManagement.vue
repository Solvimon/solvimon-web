<script setup lang="ts">
import { Button, Section, useIntl } from '@solvimon/solvimon-ui';
import { ref } from 'vue';
import type { PaymentMethodsManagementProps } from './PaymentMethodsManagement.types';
import ScreenTitle from '@/components/shared/ScreenTitle/ScreenTitle.vue';
import { ContentWithAsideLayout } from '@/layouts';
import PaymentMethodsList from '@/components/payments/PaymentMethodsList/PaymentMethodsList.vue';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.vue';

defineProps<PaymentMethodsManagementProps>();
const emit = defineEmits<{ 'set-default': [] }>();

const { $t } = useIntl();

const showPaymentMethodForm = ref(false);
</script>

<template>
    <ContentWithAsideLayout>
        <template #header>
            <ScreenTitle
                :title="
                    $t({
                        defaultMessage: 'Payment methods',
                        id: 'screens.payment_method_management.title',
                        description: 'The title for the payment method management screen ',
                    })
                "
                :description="
                    $t({
                        defaultMessage:
                            'Add a new payment method or set a default payment method for your payments.',
                        id: 'screens.payment_method_management.description',
                        description:
                            'The descriptive text for the payment method management screen',
                    })
                "
            />
        </template>
        <template #content>
            <Section no-border no-spacing content-background="none" title="Your payment methods">
                <PaymentMethodsList
                    :payment-methods="paymentMethods"
                    @set-default="emit('set-default')"
                />
            </Section>

            <PaymentMethodForm
                v-if="showPaymentMethodForm"
                :customer="customer"
                :payment-method-options="paymentMethodOptions"
            />

            <template v-if="showPaymentMethodForm">
                <Button color="gray" variant="outline" @click="showPaymentMethodForm = false"
                    >Cancel</Button
                >
            </template>
            <template v-else>
                <Button color="gray" variant="outline" @click="showPaymentMethodForm = true"
                    >Add payment method</Button
                >
            </template>
        </template>
    </ContentWithAsideLayout>
</template>
