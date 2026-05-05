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

## Release pipeline

Releases are published to [npm](https://www.npmjs.com/package/@solvimon/solvimon-web) automatically via GitHub Actions when a version tag is pushed.

### Cutting a release

```bash
# Bump the version (choose one)
npm run version:patch   # 0.1.0 → 0.1.1  (bug fixes)
npm run version:minor   # 0.1.0 → 0.2.0  (new features)
npm run version:major   # 0.1.0 → 1.0.0  (breaking changes)

# Push the commit and the tag
git push --follow-tags
```

The CI pipeline will run the test suite and, if it passes, publish the new version to npm.

### Required GitHub secrets

| Secret             | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `NPM_TOKEN`        | npm access token with publish rights to the `@solvimon` org |
| `GITLAB_NPM_TOKEN` | GitLab token for installing `@solvimon/*` dependencies      |

Want to contribute? Check the [developer documentation](./docs/development/readme.md).
