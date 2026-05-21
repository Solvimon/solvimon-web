<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type {
    ExpressPaymentMethodEmits,
    ExpressPaymentMethodProps,
} from './ExpressPaymentMethod.types';
import ExpressPaymentMethodButton from '@/components/payments/ExpressPaymentMethodButton/ExpressPaymentMethodButton.vue';
import { getAdyenExpressCheckoutConfiguration } from '@/utils/adyen';
import { useLogger } from '@/components/providers';

const props = defineProps<ExpressPaymentMethodProps>();
const emit = defineEmits<ExpressPaymentMethodEmits>();

const paypalButtonRef = ref<HTMLDivElement>();

const logger = useLogger();

const initPaypal = async () => {
    const { AdyenCheckout, PayPal } = await import('@adyen/adyen-web');

    const checkout = await AdyenCheckout(
        getAdyenExpressCheckoutConfiguration({
            locale: props.locale,
            amount: props.amount,
            countryCode: props.countryCode,
            paymentMethodOptionResponse: props.paymentMethodOptionsResponse,
            logger,
        }),
    );

    const paypal = new PayPal(checkout, {
        isExpress: true,
        blockPayPalPayLaterButton: true,
        blockPayPalCreditButton: true,
        blockPayPalVenmoButton: true,
        style: {
            height: 55,
        },
        onInit: () => {
            emit('ready');
        },
    });

    if (!paypalButtonRef.value) {
        logger.error(
            'EXPRESS_CHECKOUT_PAYPAL_ERROR',
            'The PayPal button reference is not found and cannot be mounted',
        );
        return;
    }

    try {
        await paypal.isAvailable();
        paypal.mount(paypalButtonRef.value);
    } catch (error) {
        logger.error('EXPRESS_CHECKOUT_PAYPAL_ERROR', 'Failed mounting PayPal express button', {
            error,
        });
    }
};

onMounted(() => {
    void initPaypal();
});
</script>

<template>
    <div class="relative overflow-hidden">
        <ExpressPaymentMethodButton v-if="isVisible" type="paypal" class="w-full" />
        <div ref="paypalButtonRef" class="absolute inset-0 opacity-[0.0001]"></div>
    </div>
</template>
