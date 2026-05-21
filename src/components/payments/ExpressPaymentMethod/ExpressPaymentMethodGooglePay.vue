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

const googlePayButtonRef = ref<HTMLDivElement>();

const logger = useLogger();

const initGooglePay = async () => {
    const { AdyenCheckout, GooglePay } = await import('@adyen/adyen-web');

    const checkout = await AdyenCheckout(
        getAdyenExpressCheckoutConfiguration({
            locale: props.locale,
            amount: props.amount,
            countryCode: props.countryCode,
            paymentMethodOptionResponse: props.paymentMethodOptionsResponse,
            logger,
        }),
    );

    const googlePay = new GooglePay(checkout, { isExpress: true });

    if (!googlePayButtonRef.value) {
        logger.error(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'The Google Pay button reference is not found and cannot be mounted',
        );
        return;
    }

    try {
        await googlePay.isAvailable();
        googlePay.mount(googlePayButtonRef.value);
        emit('ready');
    } catch (error) {
        logger.error(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'Failed mounting Google Pay express button',
            { error },
        );
    }
};

const handleClick = () => {
    const googlePayButton = googlePayButtonRef.value?.querySelector('#gpay-button-online-api-id');
    if (googlePayButton) {
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        googlePayButton.dispatchEvent(clickEvent);
    }
};

onMounted(() => {
    void initGooglePay();
});
</script>

<template>
    <ExpressPaymentMethodButton v-if="isVisible" type="googlepay" @click="handleClick" />
    <div class="absolute h-[1px] w-[1px] overflow-hidden opacity-0">
        <div ref="googlePayButtonRef"></div>
    </div>
</template>
