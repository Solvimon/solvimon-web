# @solvimon/solvimon-web

Solvimon's front-end SDK. Provides framework-agnostic web components and a set of screens for building a billing self-serve experience.

## Installation

```bash
npm install @solvimon/solvimon-web
```

## Requirements

Every component requires at minimum:

| Property      | Type                 | Description                                 |
| ------------- | -------------------- | ------------------------------------------- |
| `token`       | `string`             | Session token fetched from the Solvimon API |
| `environment` | `"TEST"` \| `"LIVE"` | Target environment                          |

## Usage

The SDK exports web components (Custom Elements). There are two ways to register them.

### Auto-register via define function

Call the `define` function once — it registers the custom element globally.

```tsx
import { defineSolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

defineSolvimonCheckout();

export default function Page() {
    return <solvimon-checkout token="<token>" environment="LIVE" />;
}
```

### Manual registration (recommended for Vue — enables typed components)

```vue
<script setup lang="ts">
import { SolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

if (!customElements.get('solvimon-checkout')) {
    customElements.define('solvimon-checkout', SolvimonCheckout);
}
</script>

<template>
    <solvimon-checkout token="<token>" environment="LIVE" />
</template>
```

### Server-side rendering (SSR / isomorphic)

The define functions access browser APIs and must only run client-side. Lazy-import them inside a client-only lifecycle hook:

```tsx
import { useEffect } from 'react';

export default function Page() {
    useEffect(() => {
        import('@solvimon/solvimon-web/screens/checkout').then(({ defineSolvimonCheckout }) =>
            defineSolvimonCheckout(),
        );
    }, []);

    return <solvimon-checkout token="<token>" environment="LIVE" />;
}
```

## CSS overrides

Solvimon components render inside shadow DOM, so CSS from the host page cannot style them directly. Pass `cssOverrides` to `createSolvimonCore` to inject customer CSS into each SDK shadow root.

```ts
import { createSolvimonCore } from '@solvimon/solvimon-web/core';

const solvimon = createSolvimonCore({
    environment: 'TEST',
    cssOverrides: `
        .sv-root {
            font-family: Inter, sans-serif;
        }

        .sv-checkout__submit {
            border-radius: 24px !important;
        }
    `,
});
```

Use the public `sv-*` classes as styling hooks. Do not rely on internal Tailwind utility classes, because those can change.

For more details, see [`@solvimon/solvimon-web/core`](./src/public/core/README.md).

## Available components

### Screens

Full-page experiences.

| Export path                                           | Custom element                    |
| ----------------------------------------------------- | --------------------------------- |
| `@solvimon/solvimon-web/screens/checkout`             | `<solvimon-checkout>`             |
| `@solvimon/solvimon-web/screens/customer-overview`    | `<solvimon-customer-overview>`    |
| `@solvimon/solvimon-web/screens/upgrade-subscription` | `<solvimon-upgrade-subscription>` |

### Components

Embeddable building blocks.

| Export path                                                  | Custom element                        |
| ------------------------------------------------------------ | ------------------------------------- |
| `@solvimon/solvimon-web/components/billing-information`      | `<solvimon-billing-information>`      |
| `@solvimon/solvimon-web/components/billing-information-form` | `<solvimon-billing-information-form>` |
| `@solvimon/solvimon-web/components/customer-payment-methods` | `<solvimon-customer-payment-methods>` |
| `@solvimon/solvimon-web/components/invoice`                  | `<solvimon-invoice>`                  |
| `@solvimon/solvimon-web/components/invoice-details`          | `<solvimon-invoice-details>`          |
| `@solvimon/solvimon-web/components/invoices-list`            | `<solvimon-invoices-list>`            |
| `@solvimon/solvimon-web/components/payment-history`          | `<solvimon-payment-history>`          |
| `@solvimon/solvimon-web/components/payment-method-form`      | `<solvimon-payment-method-form>`      |
| `@solvimon/solvimon-web/components/subscription-schedules`   | `<solvimon-subscription-schedules>`   |
| `@solvimon/solvimon-web/components/subscriptions-list`       | `<solvimon-subscriptions-list>`       |
| `@solvimon/solvimon-web/components/wallet-balances`          | `<solvimon-wallet-balances>`          |

## Supported Adyen payment methods

### Cards

- American Express
- Bancontact
- Carnet
- Cartes Bancaires
- China UnionPay
- Dankort
- Diners Club
- Discover
- EFTPOS
- Elo
- Girocard
- Hipercard
- JCB
- Maestro
- Mastercard
- NYCE
- Pulse
- Star
- UnionPay
- V Pay
- Visa

### Digital wallets

- Amazon Pay
- Apple Pay
- Bancontact Mobile
- Cash App Pay
- DANA
- GCash
- Google Pay
- GoPay
- KakaoPay
- MOMO
- PayPal
- TWINT

### Direct debit

- ACH (US)
- Bacs Direct Debit (UK)
- SEPA Direct Debit
- Pay by Bank (US)

### Online banking

- EPS
- iDEAL
- Pay by Bank
- Trustly

### Buy now, pay later

- Klarna
- Zip

## Release pipeline

Releases are published to [npm](https://www.npmjs.com/package/@solvimon/solvimon-web)
automatically via GitHub Actions. See the
[publishing documentation](./docs/development/publish.md) for the release flow.

Want to contribute? Check the [developer documentation](./docs/development/readme.md).
