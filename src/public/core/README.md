# Solvimon Core – Mount API

The core module lets you **define and configure** which Solvimon screen or component to show and **mount it into a container** you provide. You do not need to register or use web components directly.

## Usage

```ts
import { createSolvimonMount } from '@solvimon/sdk/core';

const { unmount } = createSolvimonMount({
  container: '#solvimon-app',  // or document.querySelector('#solvimon-app')
  config: {
    environment: 'sandbox',
    token: 'your-portal-token',
    locale: 'en-US',
    branding: { colors: { primary: '#0066cc', secondary: '#004499' } },
  },
  view: {
    type: 'screen',
    id: 'customer-overview',
    props: {
      onViewInvoice: (payload) => console.log('View invoice', payload),
      onPayInvoice: (payload) => console.log('Pay invoice', payload),
    },
  },
});

// Later: unmount();
```

## Options

| Option | Description |
|--------|-------------|
| `container` | DOM element or CSS selector string where the view is mounted. |
| `config` | Shared configuration: `environment`, `token` (or `portalObject`), `locale`, `branding`, `experimentalFeatures`, `logLevel`, etc. Same shape as entry base props. |
| `view` | What to render: either `{ type: 'screen', id, props? }` or `{ type: 'component', id, props? }`. |

## Registered IDs

- **Screens**: `customer-overview`, `checkout`
- **Components**: `invoices-list`, `subscriptions-list`, `customer-payment-methods`, `billing-information`, `seats-and-entitlements`

Use `getRegisteredScreenIds()` and `getRegisteredComponentIds()` from `@solvimon/sdk/core` to get the list at runtime.

## Component example

```ts
createSolvimonMount({
  container: document.getElementById('invoices-section'),
  config: { environment: 'sandbox', token: '...', locale: 'en-US' },
  view: {
    type: 'component',
    id: 'invoices-list',
    props: { onViewInvoice: handleViewInvoice },
  },
});
```
