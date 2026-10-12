<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { StripeError } from '@stripe/stripe-js';
import { isEqual, useIntl } from '@solvimon/solvimon-ui';
import type {
    PaymentIntegrationFormStripeFrameEmits,
    PaymentIntegrationFormStripeFrameProps,
    StripeFrameOptions,
    StripeFrameOptionsUpdate,
} from './PaymentIntegrationFormStripeFrame.types';
import { STRIPE_FRAME_SRCDOC } from './PaymentIntegrationFormStripe.srcdoc';
import { getFrameOptionsUpdate, getFrameTargetOrigin } from './PaymentIntegrationFormStripe.lib';

const props = defineProps<PaymentIntegrationFormStripeFrameProps>();
const emit = defineEmits<PaymentIntegrationFormStripeFrameEmits>();
const { $t } = useIntl();

defineExpose({ triggerSubmit });

const iframeRef = ref<HTMLIFrameElement>();
const iframeHeight = ref(0);
const iframeSrc = ref<string>();
// Until Stripe says it is ready the frame has no elements to submit, and would drop the message.
let isReady = false;
// Tells the ready of the current setup from one an earlier setup sends late.
let initId = 0;
// What the frame was last given; until it has loaded there is nothing to update.
let sentOptions: StripeFrameOptions | undefined;

function sendInit() {
    isReady = false;
    initId += 1;
    sentOptions = props.options;
    iframeRef.value?.contentWindow?.postMessage(
        {
            type: 'stripe:init',
            initId,
            publicKey: props.publicKey,
            options: props.options,
            countryCode: props.countryCode,
            email: props.email,
            name: props.name,
        },
        getFrameTargetOrigin(window.location.origin),
    );
}

function sendUpdate(options: StripeFrameOptions, update: StripeFrameOptionsUpdate) {
    sentOptions = options;
    iframeRef.value?.contentWindow?.postMessage(
        { type: 'stripe:update', options: update },
        getFrameTargetOrigin(window.location.origin),
    );
}

/** Whether the submit was sent; one that was not will never be answered. */
function triggerSubmit(): boolean {
    const contentWindow = iframeRef.value?.contentWindow;
    if (!isReady || !contentWindow) return false;

    contentWindow.postMessage(
        {
            type: 'stripe:submit',
            countryCode: props.countryCode,
            email: props.email,
            name: props.name,
        },
        getFrameTargetOrigin(window.location.origin),
    );
    return true;
}

const STRIPE_ERROR_TYPES: Record<StripeError['type'], true> = {
    api_connection_error: true,
    api_error: true,
    authentication_error: true,
    card_error: true,
    idempotency_error: true,
    invalid_request_error: true,
    rate_limit_error: true,
    validation_error: true,
};

function isStripeErrorType(value: unknown): value is StripeError['type'] {
    return typeof value === 'string' && Object.hasOwn(STRIPE_ERROR_TYPES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function handleMessage(event: MessageEvent) {
    if (!iframeRef.value || event.source !== iframeRef.value.contentWindow) return;
    if (!isRecord(event.data)) return;

    const data = event.data;
    const type = data['type'];
    if (typeof type !== 'string' || !type.startsWith('stripe:')) return;

    switch (type) {
        case 'stripe:ready':
            if (data['initId'] === initId) isReady = true;
            emit('ready');
            break;

        case 'stripe:change':
            emit(
                'change',
                typeof data['paymentMethodType'] === 'string' ? data['paymentMethodType'] : 'card',
            );
            break;

        case 'stripe:loaderror': {
            const raw = isRecord(data['error']) ? data['error'] : {};
            emit('loaderror', {
                message: typeof raw['message'] === 'string' ? raw['message'] : undefined,
                type: isStripeErrorType(raw['type']) ? raw['type'] : undefined,
            });
            break;
        }

        case 'stripe:update:error':
            sendInit();
            break;

        case 'stripe:resize':
            if (typeof data['height'] === 'number') {
                iframeHeight.value = data['height'];
            }
            break;

        case 'stripe:submit:success':
            if (typeof data['confirmationTokenId'] === 'string') {
                emit('submit-success', data['confirmationTokenId']);
            } else {
                emit('submit-error', { message: 'Stripe returned no confirmation token' });
            }
            break;

        case 'stripe:submit:error': {
            const raw = isRecord(data['error']) ? data['error'] : {};
            emit('submit-error', {
                message: typeof raw['message'] === 'string' ? raw['message'] : undefined,
                type: isStripeErrorType(raw['type']) ? raw['type'] : undefined,
                code: typeof raw['code'] === 'string' ? raw['code'] : undefined,
            });
            break;
        }
    }
}

onMounted(() => {
    const blob = new Blob([STRIPE_FRAME_SRCDOC], { type: 'text/html' });
    iframeSrc.value = URL.createObjectURL(blob);
    window.addEventListener('message', handleMessage);
});

onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage);
    if (iframeSrc.value) URL.revokeObjectURL(iframeSrc.value);
});

watch(
    () => props.options,
    (newOptions) => {
        if (!sentOptions || isEqual(newOptions, sentOptions)) return;
        // Setting the frame up anew would put a second Payment Element in it and drop the card.
        const update = getFrameOptionsUpdate(sentOptions, newOptions);
        if (update) sendUpdate(newOptions, update);
        else sendInit();
    },
    { deep: true },
);
</script>

<template>
    <iframe
        ref="iframeRef"
        :src="iframeSrc"
        :height="iframeHeight || undefined"
        frameborder="0"
        style="width: 100%; display: block; border: none"
        :title="
            $t({
                defaultMessage: 'Payment form',
                id: 'payment_integration_form_stripe.frame_title',
                description: 'Accessible name of the frame that holds the Stripe payment fields',
            })
        "
        @load="sendInit"
    />
</template>
