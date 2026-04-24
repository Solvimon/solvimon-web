<script setup lang="ts">
import { createSolvimonCore } from '@solvimon/sdk/core';
import { onMounted, onUnmounted, ref } from 'vue';

const paymentMethodFormContainer = ref<HTMLDivElement | null>(null);

const solvimon = createSolvimonCore({
    environment: 'TEST',
    locale: 'en-US',
    logLevel: 'info',
    branding: {
        colors: {
            primary: '#1d4ed8',
            secondary: '#0f172a',
        },
    },
});

let unmountPaymentMethodForm: (() => void) | null = null;

onMounted(() => {
    if (!paymentMethodFormContainer.value) return;

    unmountPaymentMethodForm = solvimon.createComponent('payment-method-form', {
        container: paymentMethodFormContainer.value,
        portalObject: {
            object_type: 'PORTAL_URL',
            id: 'purl_example',
            type: 'CUSTOMER',
            customer_id: 'cust_example',
            token: 'replace-with-a-real-portal-token',
            status: 'PUBLISHED',
        },
        configuration: {
            variant: 'TOKENIZE',
            successRedirectUrl: 'https://example.com/customer/payment-methods',
        },
    });
});

onUnmounted(() => {
    unmountPaymentMethodForm?.();
});
</script>

<template>
    <main class="page">
        <section class="card">
            <p class="eyebrow">Published Package Demo</p>
            <h1>Solvimon Payment Method Form</h1>
            <p class="copy">
                This example mounts the published SDK component through
                <code>createSolvimonCore</code>.
            </p>
            <div ref="paymentMethodFormContainer" class="sdk-root" />
        </section>
    </main>
</template>

<style scoped>
.page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
}

.card {
    width: min(100%, 960px);
    padding: 32px;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
}

.eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
}

h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1;
    color: #0f172a;
}

.copy {
    margin: 16px 0 24px;
    max-width: 60ch;
    color: #475569;
    line-height: 1.6;
}

.copy code {
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(148, 163, 184, 0.15);
}

.sdk-root {
    min-height: 320px;
}
</style>
