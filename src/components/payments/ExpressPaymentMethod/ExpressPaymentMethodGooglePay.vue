<script setup lang="ts">
import type {
    ExpressPaymentMethodEmits,
    ExpressPaymentMethodProps,
} from './ExpressPaymentMethod.types';
import { useExpressPaymentMethod } from './useExpressPaymentMethod';
import ExpressPaymentMethodButton from '@/components/payments/ExpressPaymentMethodButton/ExpressPaymentMethodButton.vue';
import { useLogger } from '@/components/providers';

const props = defineProps<ExpressPaymentMethodProps>();
const emit = defineEmits<ExpressPaymentMethodEmits>();

const logger = useLogger();

const { buttonRef: googlePayButtonRef } = useExpressPaymentMethod({
    props,
    onMissingButton: () =>
        logger.error(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'The Google Pay button reference is not found and cannot be mounted',
        ),
    onMountFailed: (error) =>
        logger.error(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'Failed mounting Google Pay express button',
            { error },
        ),
    create: async (checkout) => {
        const { GooglePay } = await import('@adyen/adyen-web');

        return new GooglePay(checkout, { isExpress: true });
    },
    afterMount: () => emit('ready'),
});

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
</script>

<template>
    <ExpressPaymentMethodButton v-if="isVisible" type="googlepay" @click="handleClick" />
    <div class="absolute h-[1px] w-[1px] overflow-hidden opacity-0">
        <div ref="googlePayButtonRef"></div>
    </div>
</template>
