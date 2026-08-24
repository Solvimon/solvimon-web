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

const { buttonRef: paypalButtonRef } = useExpressPaymentMethod({
    props,
    onMissingButton: () =>
        logger.error(
            'EXPRESS_CHECKOUT_PAYPAL_ERROR',
            'The PayPal button reference is not found and cannot be mounted',
        ),
    onMountFailed: (error) =>
        logger.error('EXPRESS_CHECKOUT_PAYPAL_ERROR', 'Failed mounting PayPal express button', {
            error,
        }),
    create: async (checkout) => {
        const { PayPal } = await import('@adyen/adyen-web');

        return new PayPal(checkout, {
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
    },
});
</script>

<template>
    <div class="relative overflow-hidden">
        <ExpressPaymentMethodButton v-if="isVisible" type="paypal" class="w-full" />
        <div ref="paypalButtonRef" class="absolute inset-0 opacity-[0.0001]"></div>
    </div>
</template>
