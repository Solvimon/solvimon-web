<script setup lang="ts">
import { Button, formatAmount, useIntl } from '@solvimon/solvimon-ui';
import { capitalize, computed } from 'vue';
import type { PayButtonEmits, PayButtonProps } from './PayButton.types';

const props = defineProps<PayButtonProps>();
defineEmits<PayButtonEmits>();

const { $t } = useIntl();

const buttonProps = computed(() => ({
    color: props.color ?? 'primary',
    disabled: props.disabled,
    iconPrefix: props.iconPrefix,
    iconSuffix: props.iconSuffix,
    loading: props.loading,
    pill: props.pill,
    size: props.size ?? 'lg',
    square: props.square,
    tag: props.tag,
    type: props.type,
    variant: props.variant,
}));

const paymentMethodTypeLabel = computed(() => {
    switch (props.paymentMethod?.paymentMethodType) {
        case 'scheme':
            return 'Credit Card';
        case 'applepay':
            return 'Apple Pay';
        case 'googlepay':
            return 'Google Pay';
        case 'paypal':
            return 'PayPal';
        case 'ideal':
            return 'iDeal';
        case 'klarna':
            return 'Klarna';
        case 'bcmc':
            return 'BCMC';
        case 'sepadirectdebit':
            return 'SEPA';
        case 'twint':
            return 'Twint';
        case 'swish':
            return 'Swish';
        case 'vipps':
            return 'Vipps';
        case 'mbway':
            return 'MBway';
        case 'alipay':
            return 'AliPay';
        case 'wechatpayWeb':
            return 'WeChatPay';
        case 'afterpay_default':
            return 'Afterpay';
        case 'affirm':
            return 'Affirm';
        case 'ach':
            return 'ACH';
        case 'blik':
            return 'Blik';
        case 'cashapp':
            return 'Cash App Pay';
        case 'amazonpay':
            return 'Amazon Pay';
        case 'venmo':
            return 'Venmo';
        case 'clicktopay':
            return 'Click to Pay';
        case 'upi':
            return 'UPI';
        case 'revolutpay':
            return 'Revolut Pay';
        case 'ratepay':
            return 'Ratepay';
        case 'walley':
            return 'Walley';
        case 'alma':
            return 'Alma';
        case 'facilypay_3x':
        case 'facilypay_4x':
            return 'Oney';
        case 'samsungpay':
            return 'Samsung Pay';
        case 'bizum':
            return 'Bizum';
        case 'pix':
            return 'Pix';
        case 'multibanco':
            return 'Multibanco';
        case 'openbanking_UK':
            return 'Open Banking';

        default:
            return props.paymentMethod?.paymentMethodType
                ? capitalize(props.paymentMethod?.paymentMethodType)
                : '';
    }
});

const buttonText = computed(() => {
    if (props.amount && props.paymentMethod) {
        return $t(
            {
                defaultMessage: 'Pay {amount} with {type}',
                id: 'pay_button.label.amount_and_payment_method',
                description:
                    'The label for the pay button when both the amount and the payment method are known',
            },
            {
                amount: formatAmount(props.amount),
                type: paymentMethodTypeLabel.value,
            },
        );
    }

    if (props.amount) {
        return $t(
            {
                defaultMessage: 'Pay {amount}',
                id: 'pay_button.label.amount_only',
                description: 'The label for the pay button when only the amount is known',
            },
            {
                amount: formatAmount(props.amount),
                type: paymentMethodTypeLabel.value,
            },
        );
    }

    return $t({
        defaultMessage: 'Pay',
        id: 'pay_button.label.default',
        description:
            'The default label for the pay button when no amount and payment method are known',
    });
});
</script>

<template>
    <Button v-bind="buttonProps" class="w-full" @click="$emit('click', $event)">
        {{ buttonText }}
    </Button>
</template>
