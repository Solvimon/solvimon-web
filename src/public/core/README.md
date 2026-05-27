# Solvimon Core

The core module lets you define shared SDK configuration once and then mount typed Solvimon screens or components into a container you provide.

## Usage

```ts
import { createSolvimonCore } from '@solvimon/solvimon-web/core';

const solvimon = createSolvimonCore({
    environment: 'sandbox',
    token: 'your-portal-token',
    locale: 'en-US',
    branding: { colors: { primary: '#0066cc', secondary: '#004499' } },
});

const unmount = solvimon.createScreen('customer-overview', {
    container: '#solvimon-app', // or document.querySelector('#solvimon-app')
    portalObject: customerPortalObject,
});

// Later: unmount();
```

## Options

| Option                               | Description                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSolvimonCore(config)`         | Creates a reusable core instance with shared configuration such as `environment`, `token`, `locale`, `branding`, `experimentalFeatures`, and `logLevel`. |
| `createScreen(id, configuration)`    | Mounts a registered screen into the provided container and returns an `unmount` function.                                                                |
| `createComponent(id, configuration)` | Mounts a registered component into the provided container and returns an `unmount` function.                                                             |

## Registered IDs

- **Screens**: `customer-overview`, `checkout`
- **Components**: `invoice`, `invoices-list`, `subscriptions-list`, `customer-payment-methods`, `wallet-balances`, `billing-information`

Use `getRegisteredScreenIds()` and `getRegisteredComponentIds()` from `@solvimon/solvimon-web/core` to get the list at runtime.

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

## CSS overrides

Solvimon components render inside shadow DOM. CSS from the host page cannot reach into that shadow DOM, so styling overrides must be passed through the SDK configuration.

Pass `cssOverrides` to `createSolvimonCore`:

```ts
const solvimon = createSolvimonCore({
    environment: 'TEST',
    locale: 'en-US',
    cssOverrides: `
        .sv-root {
            font-family: Inter, sans-serif;
        }

        .sv-checkout__submit {
            border-radius: 24px !important;
        }

        .sv-order-summary {
            border-color: #d1d5db;
        }
    `,
});
```

The SDK injects these rules into each mounted SDK instance's shadow root as:

```html
<style data-solvimon-css-overrides>
    ...
</style>
```

Use the public `sv-*` classes as styling hooks. Do not rely on internal Tailwind utility classes, because those are implementation details and can change.

Common hooks:

| Hook                      | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `.sv-root`                | Root element for a mounted SDK screen or component.                    |
| `.sv-screen`              | Full screen SDK entries, such as checkout or customer overview.        |
| `.sv-component`           | Standalone SDK component entries, such as invoices or payment methods. |
| `.sv-action`              | SDK action buttons.                                                    |
| `.sv-loading`             | Loading state wrapper.                                                 |
| `.sv-error`               | Error state wrapper.                                                   |
| `.sv-checkout`            | Checkout screen root.                                                  |
| `.sv-checkout__submit`    | Checkout submit button.                                                |
| `.sv-order-summary`       | Order summary block.                                                   |
| `.sv-payment-methods`     | Payment methods component root.                                        |
| `.sv-payment-method-form` | Payment method form component root.                                    |

`cssOverrides` accepts a single CSS string or an array of CSS strings:

```ts
createSolvimonCore({
    cssOverrides: [
        '.sv-root { font-family: Inter, sans-serif; }',
        '.sv-checkout__submit { border-radius: 24px !important; }',
    ],
});
```

Because SDK styles are generated with Tailwind utilities, some overrides may need `!important` to win specificity.
