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

The SDK ships web components (Custom Elements), and there are two ways to put one on a page.

### Register the element yourself

Call the entry's `define` function once — it registers the custom element globally and is safe to
call more than once.

```tsx
import { defineSolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

defineSolvimonCheckout();

export default function Page() {
    return <solvimon-checkout token="<token>" environment="LIVE" />;
}
```

This is the lighter of the two: you download only the entries you name.

If the page already has an element called `solvimon-checkout` — two copies of the SDK, say — pass
your own tag name instead. Registering a name that is already taken does nothing, so without this
the second registration is silently ignored.

```ts
defineSolvimonCheckout('acme-checkout');
```

### Mount through the core

`createSolvimonCore` configures once and mounts by id, and is the only way to pass `cssOverrides`.
It loads each entry on demand, so you pay for what you mount, and it hands back an unmount
function.

```ts
import { createSolvimonCore } from '@solvimon/solvimon-web/core';

const solvimon = createSolvimonCore({ environment: 'TEST' });

const unmount = solvimon.createScreen('checkout', {
    container: '#checkout',
    portalObject,
});
```

`createScreen` and `createComponent` return synchronously; the element is appended once its entry
has loaded. An unknown id or a container that matches nothing throws straight away.

### Server-side rendering (SSR / isomorphic)

Importing an entry on the server is safe — the module has no top-level browser access. It is
`define()` that needs a browser, because `customElements` does not exist in Node, so call it from a
client-only lifecycle hook:

```tsx
import { useEffect } from 'react';
// Importing at the top level is fine; only the call below has to wait for the browser.
import { defineSolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

export default function Page() {
    useEffect(() => {
        defineSolvimonCheckout();
    }, []);

    return <solvimon-checkout token="<token>" environment="LIVE" />;
}
```

A lazy `import()` inside the hook also works, and is worth keeping if you want the entry out of your
server bundle for size reasons rather than correctness ones.

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

| Export path                                                 | Custom element                          |
| ----------------------------------------------------------- | --------------------------------------- |
| `@solvimon/solvimon-web/screens/checkout`                   | `<solvimon-checkout>`                   |
| `@solvimon/solvimon-web/screens/customer-overview`          | `<solvimon-customer-overview>`          |
| `@solvimon/solvimon-web/screens/pay-invoice`                | `<solvimon-pay-invoice>`                |
| `@solvimon/solvimon-web/screens/payment-methods-management` | `<solvimon-payment-methods-management>` |
| `@solvimon/solvimon-web/screens/subscription-details`       | `<solvimon-subscription-details>`       |
| `@solvimon/solvimon-web/screens/subscription-management`    | `<solvimon-subscription-management>`    |

### Components

Embeddable building blocks.

| Export path                                                  | Custom element                        |
| ------------------------------------------------------------ | ------------------------------------- |
| `@solvimon/solvimon-web/components/billing-information`      | `<solvimon-billing-information>`      |
| `@solvimon/solvimon-web/components/billing-information-form` | `<solvimon-billing-information-form>` |
| `@solvimon/solvimon-web/components/customer-payment-methods` | `<solvimon-customer-payment-methods>` |
| `@solvimon/solvimon-web/components/invoice`                  | `<solvimon-invoice>`                  |
| `@solvimon/solvimon-web/components/invoice-details`          | `<solvimon-invoice-details>`          |
| `@solvimon/solvimon-web/components/invoice-header`           | `<solvimon-invoice-header>`           |
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

<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->

## Error logging

The SDK emits structured log entries via the [`onLog`](#error-logging) callback. Subscribe to receive all log events and filter by `code` for programmatic handling.

### Error codes

| Code                                        | Description                                                        |
| :------------------------------------------ | :----------------------------------------------------------------- |
| `ADYEN_SUBMIT_FAILED`                       | Failed to submit Adyen drop-in                                     |
| `APPLE_PAY_AUTHORIZATION_FAILED`            | Payment authorization failed                                       |
| `APPLE_PAY_ERROR`                           | Apple Pay error                                                    |
| `AUTO_TOP_UP_CANCELLATION_FAILED`           | Failed to turn off a wallet                                        |
| `AUTO_TOP_UP_SAVE_FAILED`                   | Failed to save the automatic top-up rule                           |
| `EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR`         | The Google Pay button reference is not found and cannot be mounted |
| `EXPRESS_CHECKOUT_PAYPAL_ERROR`             | The PayPal button reference is not found and cannot be mounted     |
| `INITIAL_DATA_LOAD_FAILED`                  | Failed to load initial data                                        |
| `INTEGRATION_ERROR`                         | Unhandled error in payment submission flow                         |
| `INVALID_COUNTRY_CODE`                      | invalid country code provided:…                                    |
| `INVALID_EMAIL`                             | invalid email provided:…                                           |
| `INVALID_REDIRECT_RESULT`                   | Redirect result is set but payment acceptor id is missing          |
| `INVALID_TOKEN`                             | Failed to fetch access token                                       |
| `INVOICE_PREVIEW_FAILED`                    | Failed to load top-up invoice preview                              |
| `PAYMENT_AUTHORIZATION_FAILED`              | Failed payment authorization for payment acceptor with id…         |
| `PAYMENT_DETAILS_CALL_FAILED`               | Failed fetching payment details                                    |
| `PAYMENT_INTEGRATION_INITIALIZATION_FAILED` | Failed to mount Adyen web drop-in                                  |
| `PAYMENT_METHOD_OPTIONS_LOAD_FAILED`        | Failed to load the payment methods the checkout can offer          |
| `PROMOTION_CODE_APPLY_FAILED`               | Failed to apply promotion code                                     |
| `PROMOTION_CODE_REMOVE_FAILED`              | Failed to remove promotion code                                    |
| `REQUEST_PARSE_FAILED`                      | Failed to parse JSON response                                      |
| `RESOURCE_REVOKED`                          | Failed to load portal resource                                     |
| `SESSION_EXPIRED`                           | Stopped refreshing the access token after repeated 401 responses   |
| `STRIPE_ACTION_FAILED`                      | Missing client_secret in Stripe ACTION_REQUIRED response           |
| `STRIPE_CONFIRMATION_TOKEN_FAILED`          | Stripe submission failed                                           |
| `STRIPE_REDIRECT_RETURN_FAILED`             | Stripe redirect returned non-succeeded status                      |
| `STRIPE_SUBMIT_FAILED`                      | Unexpected error during Stripe submission                          |
| `SUBSCRIPTION_CANCELLATION_FAILED`          | Failed to change the cancellation state of a subscription          |
| `SUBSCRIPTION_LOAD_FAILED`                  | Failed to load the subscription the checkout prices                |
| `SUBSCRIPTION_UPDATE_FAILED`                | Failed to start a new pricing plan schedule                        |
| `TOKENIZATION_FAILED`                       | Missing customer id for payment acceptor with id…                  |
| `TOP_UP_FAILED`                             | Failed to charge the wallet top-up                                 |
| `UNHANDLED_ERROR`                           | An error that reached the SDK with no more specific code           |

### Warning codes

| Code                          | Description                                                     |
| :---------------------------- | :-------------------------------------------------------------- |
| `ACTIVE_SCHEDULE_NOT_FOUND`   | No schedule is currently being billed                           |
| `ADYEN_INVALID_CONFIGURATION` | No environment set for adyen advanced flow, defaulted to live   |
| `APPLE_PAY_ACTION_REQUIRED`   | Payment requires additional action                              |
| `INVOICE_PREVIEW_SKIPPED`     | Skipped the top-up invoice preview: no schedule to charge it on |
| `TRANSLATION_LOAD_FAILED`     | Failed to load translations for locale…                         |

<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->
