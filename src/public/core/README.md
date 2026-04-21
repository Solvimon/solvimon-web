# Solvimon Core

The core module lets you define shared SDK configuration once and then mount typed Solvimon screens or components into a container you provide.

## Usage

```ts
import { createSolvimonCore } from '@solvimon/sdk/core';

const solvimon = createSolvimonCore({
  environment: 'sandbox',
  token: 'your-portal-token',
  locale: 'en-US',
  branding: { colors: { primary: '#0066cc', secondary: '#004499' } },
});

const unmount = solvimon.createScreen('customer-overview', {
  container: '#solvimon-app',  // or document.querySelector('#solvimon-app')
  portalObject: customerPortalObject,
});

// Later: unmount();
```

## Options

| Option | Description |
|--------|-------------|
| `createSolvimonCore(config)` | Creates a reusable core instance with shared configuration such as `environment`, `token`, `locale`, `branding`, `experimentalFeatures`, and `logLevel`. |
| `createScreen(id, configuration)` | Mounts a registered screen into the provided container and returns an `unmount` function. |
| `createComponent(id, configuration)` | Mounts a registered component into the provided container and returns an `unmount` function. |

## Registered IDs

- **Screens**: `customer-overview`, `checkout`
- **Components**: `invoice`, `invoices-list`, `subscriptions-list`, `customer-payment-methods`, `billing-information`

Use `getRegisteredScreenIds()` and `getRegisteredComponentIds()` from `@solvimon/sdk/core` to get the list at runtime.

## Component example

```ts
const solvimon = createSolvimonCore({
  environment: 'sandbox',
  token: '...',
  locale: 'en-US',
});

const unmount = solvimon.createComponent('invoices-list', {
  container: document.getElementById('invoices-section'),
  portalObject: customerPortalObject,
  configuration: {
    showViewButton: true,
  },
});
```
