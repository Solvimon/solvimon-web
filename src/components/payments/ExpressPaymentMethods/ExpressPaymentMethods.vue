<script setup lang="ts">
import { Typography, useIntl, DividerText } from '@solvimon/ui';
import { computed, ref } from 'vue';
import type { PaymentMethodOptionResponseEntry } from '@solvimon/types';
import type {
    ExpressPaymentMethodsEmits,
    ExpressPaymentMethodsProps,
} from './ExpressPaymentMethods.types';
import ExpressPaymentMethodApplePay from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethodApplePay.vue';
import ExpressPaymentMethodPaypal from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethodPaypal.vue';
import ExpressPaymentMethodGooglePay from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethodGooglePay.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

const DEFAULT_EXPRESS_PAYMENT_BUTTON_COUNT = 2;
const ENABLED_EXPRESS_PAYMENT_METHOD_TYPES = ['applepay'];

const props = defineProps<ExpressPaymentMethodsProps>();
defineEmits<ExpressPaymentMethodsEmits>();

const { $t } = useIntl();

const isApplePayReady = ref<boolean>(false);
const isGooglePayReady = ref<boolean>(false);
const isPayPalReady = ref<boolean>(false);

const paymentMethodOptionsResponseEntryIncludingApplePay = computed<
    PaymentMethodOptionResponseEntry | undefined
>(() => {
    if (!ENABLED_EXPRESS_PAYMENT_METHOD_TYPES.includes('applepay')) {
        return undefined;
    }

    return props.paymentMethodsOptionsResponse?.find((entry) =>
        entry.options.some((option) => option.name.toLowerCase() === 'apple pay'),
    );
});

const paymentMethodOptionsResponseEntryIncludingPayPal = computed<
    PaymentMethodOptionResponseEntry | undefined
>(() => {
    if (!ENABLED_EXPRESS_PAYMENT_METHOD_TYPES.includes('paypal')) {
        return undefined;
    }

    return props.paymentMethodsOptionsResponse?.find((entry) =>
        entry.options.some((option) => option.name.toLowerCase() === 'paypal'),
    );
});

const paymentMethodOptionsResponseEntryIncludingGooglePay = computed<
    PaymentMethodOptionResponseEntry | undefined
>(() => {
    if (!ENABLED_EXPRESS_PAYMENT_METHOD_TYPES.includes('googlepay')) {
        return undefined;
    }

    return props.paymentMethodsOptionsResponse?.find((entry) =>
        entry.options.some((option) => option.name.toLowerCase() === 'google pay'),
    );
});

const hasPaymentMethodOptions = computed(() => {
    return (
        paymentMethodOptionsResponseEntryIncludingApplePay.value ||
        paymentMethodOptionsResponseEntryIncludingGooglePay.value ||
        paymentMethodOptionsResponseEntryIncludingPayPal.value
    );
});

const isReady = computed(() => {
    if (props.paymentMethodsOptionsResponse?.length === 0) {
        return false;
    }

    const applePayReady =
        !paymentMethodOptionsResponseEntryIncludingApplePay.value || isApplePayReady.value;

    const googlePayReady =
        !paymentMethodOptionsResponseEntryIncludingGooglePay.value || isGooglePayReady.value;

    const payPalReady =
        !paymentMethodOptionsResponseEntryIncludingPayPal.value || isPayPalReady.value;

    // All express payment methods must be ready
    return applePayReady && googlePayReady && payPalReady;
});

const expressPaymentButtonCount = computed(() => {
    if (!isReady.value) {
        return DEFAULT_EXPRESS_PAYMENT_BUTTON_COUNT;
    }

    return (
        (paymentMethodOptionsResponseEntryIncludingApplePay.value ? 1 : 0) +
        (paymentMethodOptionsResponseEntryIncludingGooglePay.value ? 1 : 0) +
        (paymentMethodOptionsResponseEntryIncludingPayPal.value ? 1 : 0)
    );
});
</script>

<template>
    <div v-if="hasPaymentMethodOptions">
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
            <template v-if="!isReady">
                <Skeleton class="h-11 col-span-3" />
                <Skeleton class="h-11 col-span-3" />
            </template>
            <div
                class="col-span-3 md:col-span-2"
                :class="{
                    hidden: !paymentMethodOptionsResponseEntryIncludingApplePay,
                    '!col-span-6': expressPaymentButtonCount === 1,
                    'md:!col-span-3': expressPaymentButtonCount === 2,
                    '!col-span-6 md:!col-span-2': expressPaymentButtonCount === 3,
                }"
            >
                <ExpressPaymentMethodApplePay
                    v-if="paymentMethodOptionsResponseEntryIncludingApplePay"
                    :amount="amount"
                    :billing-information="billingInformation"
                    :country-code="countryCode"
                    :locale="locale"
                    :is-visible="isReady"
                    :payment-method-options-response="
                        paymentMethodOptionsResponseEntryIncludingApplePay
                    "
                    :on-billing-information-change="onBillingInformationChange"
                    @ready="isApplePayReady = true"
                    @update-billing-information="$emit('update-billing-information', $event)"
                />
            </div>

            <div
                class="col-span-3 md:col-span-2"
                :class="{
                    hidden: !paymentMethodOptionsResponseEntryIncludingGooglePay,
                    'col-span-6 md:col-span-6': expressPaymentButtonCount === 1,
                    'md:!col-span-3': expressPaymentButtonCount === 2,
                }"
            >
                <ExpressPaymentMethodGooglePay
                    v-if="paymentMethodOptionsResponseEntryIncludingGooglePay"
                    :amount="amount"
                    :billing-information="billingInformation"
                    :country-code="countryCode"
                    :locale="locale"
                    :is-visible="isReady"
                    :payment-method-options-response="
                        paymentMethodOptionsResponseEntryIncludingGooglePay
                    "
                    @ready="isGooglePayReady = true"
                />
            </div>

            <div
                class="col-span-3 md:col-span-2"
                :class="{
                    hidden: !paymentMethodOptionsResponseEntryIncludingPayPal,
                    'col-span-6 md:col-span-6': expressPaymentButtonCount === 1,
                    'md:!col-span-3': expressPaymentButtonCount === 2,
                }"
            >
                <ExpressPaymentMethodPaypal
                    v-if="paymentMethodOptionsResponseEntryIncludingPayPal"
                    :amount="amount"
                    :billing-information="billingInformation"
                    :country-code="countryCode"
                    :locale="locale"
                    :is-visible="isReady"
                    :payment-method-options-response="
                        paymentMethodOptionsResponseEntryIncludingPayPal
                    "
                    @ready="isPayPalReady = true"
                />
            </div>
        </div>
        <div class="h-4 mt-4">
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
