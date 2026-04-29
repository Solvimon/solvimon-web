# @solvimon/solvimon-web

## Getting started

```bash
npm install @solvimon/solvimon-web
```

Solvimon's SDK exports web components, that are framework agnostic. Each component requires at least:

| Property      | Description                                  |
| ------------- | -------------------------------------------- |
| `token`       | Fetched from our API                         |
| `environment` | Specifies the environment (`TEST` or `LIVE`) |

It supports two ways of importing:

### `defineSolvimonAddPaymentMethodForm`

```tsx
import { defineSolvimonAddPaymentMethodForm } from '@solvimon/solvimon-web/solvimon-add-payment-method-form';

defineSolvimonAddPaymentMethodForm();

export default function Home() {
    return (
        <solvimon-add-payment-method-form
            token="<my-token-retrieved-from-solvimon-api>"
            environment="LIVE"
        />
    );
}
```

### Register yourself (beneficial in Vue setup for typed components)

```vue
<script setup lang="ts">
import { SolvimonAddPaymentMethodForm } from '@solvimon/solvimon-web/solvimon-add-payment-method-form';

if (customElements.get('solvimon-add-payment-method-form')) {
    customElements.define('solvimon-add-payment-method-form', SolvimonAddPaymentMethodForm);
}
</script>

<template>
    <solvimon-add-payment-method-form
        token="<my-token-retrieved-from-solvimon-api>"
        environment="LIVE"
    />
</template>
```

### Isomorphic (server side rendered) usage

Our component define functions might cause issues when run in isomorphic setups. To solve this, you might want to consider only loading our SDK client side only:

```tsx
import { useEffect } from 'react';

export default function Home() {
    useEffect(() => {
        async function loadSolvimonSdkComponent() {
            const { defineSolvimonAddPaymentMethodForm } = await import(
                '@solvimon/solvimon-web/solvimon-add-payment-method-form'
            );
            defineSolvimonAddPaymentMethodForm();
        }

        loadSolvimonSdkComponent();
    }, []);

    return (
        <solvimon-add-payment-method-form
            token="<my-token-retrieved-from-solvimon-api>"
            environment="LIVE"
        />
    );
}
```
