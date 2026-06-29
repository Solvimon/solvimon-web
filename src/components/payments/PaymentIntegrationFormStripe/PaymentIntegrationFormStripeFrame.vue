<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { isEqual } from '@solvimon/solvimon-ui';
import type {
    PaymentIntegrationFormStripeFrameEmits,
    PaymentIntegrationFormStripeFrameProps,
} from './PaymentIntegrationFormStripeFrame.types';
import { STRIPE_FRAME_SRCDOC } from './PaymentIntegrationFormStripe.srcdoc';

const props = defineProps<PaymentIntegrationFormStripeFrameProps>();
const emit = defineEmits<PaymentIntegrationFormStripeFrameEmits>();

defineExpose({ triggerSubmit });

const iframeRef = ref<HTMLIFrameElement>();
const iframeHeight = ref(0);
const iframeSrc = ref<string>();

function sendInit() {
    iframeRef.value?.contentWindow?.postMessage(
        { type: 'stripe:init', publicKey: props.publicKey, options: props.options },
        '*',
    );
}

function triggerSubmit() {
    iframeRef.value?.contentWindow?.postMessage({ type: 'stripe:submit' }, '*');
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
                type: typeof raw['type'] === 'string' ? raw['type'] : undefined,
            });
            break;
        }

        case 'stripe:resize':
            if (typeof data['height'] === 'number') {
                iframeHeight.value = data['height'];
            }
            break;

        case 'stripe:submit:success':
            if (typeof data['confirmationTokenId'] === 'string') {
                emit('submit-success', data['confirmationTokenId']);
            }
            break;

        case 'stripe:submit:error': {
            const raw = isRecord(data['error']) ? data['error'] : {};
            emit('submit-error', {
                message: typeof raw['message'] === 'string' ? raw['message'] : undefined,
                type: typeof raw['type'] === 'string' ? raw['type'] : undefined,
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
    (newOptions, oldOptions) => {
        if (isEqual(newOptions, oldOptions)) return;
        sendInit();
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
        style="width: 100%; display: block; border: none;"
        title="Payment form"
        @load="sendInit"
    />
</template>
