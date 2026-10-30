# Solvimon Core

The core module lets you define shared SDK configuration once and then mount typed Solvimon screens or components into a container you provide.

## Usage

```ts
import { createSolvimonCore } from '@solvimon/solvimon-web/core';

const solvimon = createSolvimonCore({
    environment: 'TEST',
    locale: 'en-US',
    branding: { colors: { primary: '#0066cc', secondary: '#004499' } },
});

// The portal URL your server created through the Solvimon API. It carries the token the element
// signs in with, so there is no separate `token` option.
const unmount = solvimon.createScreen('customer-overview', {
    container: '#solvimon-app', // or document.querySelector('#solvimon-app')
    portalObject: customerPortalObject,
});

// Later: unmount();
```

## Options

| Option                               | Description                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSolvimonCore(config)`         | Creates a reusable core instance with shared configuration such as `environment`, `locale`, `branding`, `experimentalFeatures`, and `logLevel`. |
| `createScreen(id, configuration)`    | Mounts a registered screen into the provided container and returns an `unmount` function.                                                       |
| `createComponent(id, configuration)` | Mounts a registered component into the provided container and returns an `unmount` function.                                                    |

## Registered IDs

- **Screens**: `customer-overview`, `checkout`, `checkout-session`, `subscription-management`, `subscription-details`, `pay-invoice`, `payment-methods-management`
- **Components**: `invoice`, `invoice-header`, `invoice-details`, `invoices-list`, `payment-history`, `subscriptions-list`, `subscription-schedules`, `customer-payment-methods`, `wallet-balances`, `billing-information`, `billing-information-form`, `payment-method-form`

Use `getRegisteredScreenIds()` and `getRegisteredComponentIds()` from `@solvimon/solvimon-web/core` to get the list at runtime.

## Types

`@solvimon/solvimon-web/core` exports the types you write against, so an option you misspell is a build error rather than a feature that quietly stays off:

```ts
import type {
    CustomerPortalUrl,
    CheckoutPagePortalUrl,
    PortalUrl,
    Environment,
    PlatformBranding,
    IntlMessages,
    CountryCode,
    Amount,
    ComponentConfigurationById,
    ScreenConfigurationById,
} from '@solvimon/solvimon-web/core';

// The options a given id accepts:
type InvoicesListOptions = ComponentConfigurationById['invoices-list'];
```

Every option a `configuration` leaves out stays at its documented default, so passing only the ones you care about is safe.

Nothing else needs installing: the types the SDK's own dependencies contribute are published inside the package.

## Component example

```ts
const solvimon = createSolvimonCore({
    environment: 'TEST',
    locale: 'en-US',
});

const unmount = solvimon.createComponent('invoices-list', {
    container: '#invoices-section', // or an Element; getElementById can return null
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

The SDK adopts these rules into each mounted SDK instance's shadow root as a stylesheet of their
own, after the SDK's own styles. A browser that cannot adopt stylesheets gets them as:

```html
<style data-solvimon-css-overrides>
    ...
</style>
```

`@import` rules are removed: load fonts and other stylesheets from your own page.

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
