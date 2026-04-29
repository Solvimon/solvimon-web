# Vue

This example shows how to mount the published `payment-method-form` SDK component in a Vue + Vite app by using `createSolvimonCore` from `@solvimon/solvimon-web/core`.

The current example lives in [src/App.vue](./src/App.vue) and mounts the component into a container `div` on `onMounted`.

Before using it for real, replace the placeholder `portalObject` and token with values returned by your backend.

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Integration Pattern

```vue
<script setup lang="ts">
import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import { onMounted, onUnmounted, ref } from 'vue';

const container = ref<HTMLDivElement | null>(null);
const solvimon = createSolvimonCore({
    environment: 'DEV',
    locale: 'en-US',
    logLevel: 'info',
});

let unmount: (() => void) | null = null;

onMounted(() => {
    if (!container.value) return;

    unmount = solvimon.createComponent('payment-method-form', {
        container: container.value,
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
    unmount?.();
});
</script>
```

The example also imports Adyen’s stylesheet in [src/main.ts](./src/main.ts), because the payment method form depends on it.
