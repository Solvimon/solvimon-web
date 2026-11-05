<script setup lang="ts">
import { Typography, useIntl, DividerText } from '@solvimon/solvimon-ui';
import { computed, ref } from 'vue';
import type { PaymentMethodOptionResponseEntry } from '@solvimon/solvimon-types';
import type {
    ExpressPaymentMethodsEmits,
    ExpressPaymentMethodsProps,
} from './ExpressPaymentMethods.types';
import ExpressPaymentMethodApplePay from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethodApplePay.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

const props = defineProps<ExpressPaymentMethodsProps>();
defineEmits<ExpressPaymentMethodsEmits>();

const { $t } = useIntl();

const isApplePayReady = ref<boolean>(false);
const isApplePayUnavailable = ref<boolean>(false);

const applePayEntry = computed<PaymentMethodOptionResponseEntry | undefined>(() =>
    props.paymentMethodsOptionsResponse?.find((entry) =>
        entry.options?.some(
            (option) =>
                option.name.toLowerCase() === 'apple pay' &&
                option.payment_gateway_variant === 'ADYEN',
        ),
    ),
);

const paymentMethodOptionsResponseEntryIncludingApplePay = computed<
    PaymentMethodOptionResponseEntry | undefined
>(() => (isApplePayUnavailable.value ? undefined : applePayEntry.value));

const isReady = computed(
    () => props.paymentMethodsOptionsResponse?.length !== 0 && isApplePayReady.value,
);
</script>

<template>
    <div v-if="paymentMethodOptionsResponseEntryIncludingApplePay" class="mt-4n">
        <div class="mb-2">
            <Skeleton v-if="!isReady" variant="title" />
            <Typography v-else variant="heading-3" tag="h2">{{
                $t({
                    defaultMessage: 'Subscribe instantly with',
                    id: 'checkout.express_payment_methods.title',
                    description:
                        'The title of the express payment methods block in the checkout form',
                })
            }}</Typography>
        </div>
        <div class="grid grid-cols-6 gap-1 md:gap-2">
            <Skeleton v-if="!isReady" class="col-span-6 h-11" />
            <div class="col-span-6">
                <ExpressPaymentMethodApplePay
                    :amount="amount"
                    :billing-information="billingInformation"
                    :country-code="countryCode"
                    :locale="locale"
                    :is-visible="isReady"
                    :payment-method-options-response="
                        paymentMethodOptionsResponseEntryIncludingApplePay
                    "
                    :on-billing-information-change="onBillingInformationChange"
                    :context="context"
                    :validate-on-submit="validateOnSubmit"
                    @ready="isApplePayReady = true"
                    @unavailable="isApplePayUnavailable = true"
                    @update-billing-information="$emit('update-billing-information', $event)"
                    @payment-success="$emit('payment-success')"
                    @payment-failed="$emit('payment-failed', $event)"
                />
            </div>
        </div>
        <div class="mt-4 h-4">
            <Skeleton v-if="!isReady" variant="divider-text" />
            <DividerText
                v-else
                :text="
                    $t({
                        defaultMessage: 'Or',
                        id: 'checkout.express_payment_methods.divider_text',
                        description:
                            'The text of the divider text in the express payment methods block in the checkout form',
                    })
                "
                text-position="center"
            />
        </div>
    </div>
</template>
