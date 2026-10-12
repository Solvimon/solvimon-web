# @solvimon/solvimon-web

Solvimon's front-end SDK. Provides framework-agnostic web components and a set of screens for building a billing self-serve experience.

## Installation

```bash
npm install @solvimon/solvimon-web
```

## Requirements

Every component requires at minimum:

| Property       | Type                 | Description                                                                     |
| -------------- | -------------------- | ------------------------------------------------------------------------------- |
| `portalObject` | `PortalUrl`          | The portal URL your server creates through the Solvimon API, passed on as it is |
| `environment`  | `"TEST"` \| `"LIVE"` | Target environment                                                              |

`portalObject` is an object, so set it as a JavaScript property rather than an HTML attribute. It
carries the portal token the element signs in with; there is no separate `token` property.

An element renders only for a published portal of the type it accepts: `checkout` takes an
`INIT_PRICING_PLAN_SUBSCRIPTION` portal, every other element a `CUSTOMER` one. Any other type logs
`PORTAL_TYPE_NOT_ALLOWED` and renders nothing. A revoked portal logs `RESOURCE_REVOKED`; the
checkout shows its "Checkout not available" notice, and the other elements render nothing.

## Usage

The SDK ships web components (Custom Elements), and there are two ways to put one on a page.

### Register the element yourself

Call the entry's `define` function once — it registers the custom element globally and is safe to
call more than once.

```ts
import { defineSolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

defineSolvimonCheckout();

const checkout = document.createElement('solvimon-checkout');
Object.assign(checkout, { environment: 'LIVE', portalObject });
document.querySelector('#checkout')?.append(checkout);
```

This is the lighter of the two: you download only the entries you name.

If the page already has an element called `solvimon-checkout` — two copies of the SDK, say — pass
your own tag name instead. Registering a name that is already taken does nothing, so without this
the second registration is silently ignored.

```ts
defineSolvimonCheckout('acme-checkout');
```

An element is registered under one name only. `define` returns the name it is registered under, and
calling it again — with or without a name — returns that first name instead of registering another.
`createSolvimonCore` mounts the element under the name you chose.

### Mount through the core

`createSolvimonCore` configures once and mounts by id. It loads each entry on demand, so you pay for what you mount, and it hands back an unmount
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
import { useEffect, useRef } from 'react';
import type { CheckoutPagePortalUrl } from '@solvimon/solvimon-web/core';
// Importing at the top level is fine; only the call below has to wait for the browser.
import { defineSolvimonCheckout } from '@solvimon/solvimon-web/screens/checkout';

export default function Page({ portalObject }: { portalObject: CheckoutPagePortalUrl }) {
    const checkout = useRef<HTMLElement>(null);

    useEffect(() => {
        defineSolvimonCheckout();
    }, []);

    // An object has to reach the element as a property, which JSX attributes do not do everywhere.
    useEffect(() => {
        if (checkout.current) Object.assign(checkout.current, { portalObject });
    }, [portalObject]);

    return <solvimon-checkout ref={checkout} environment="LIVE" />;
}
```

A lazy `import()` inside the hook also works, and is worth keeping if you want the entry out of your
server bundle for size reasons rather than correctness ones.

### Changing properties after mount

An element follows the properties you change after it has mounted:

- A `portalObject` with another token, or another `environment`, starts the element over: it signs
  in again and reloads everything.
- An id in `configuration` — `invoiceId` or `subscriptionId` — loads the new invoice or
  subscription. Whatever the customer had open for the old one is closed.
- `experimentalFeatures`, `branding` and `cssOverrides` apply in place.
- A new `locale` loads its translations and renders the element again from the start, so anything
  the customer had typed is lost. Set it before the element mounts where you can.

The checkout reads `email`, `countryCode` and `enabledPricingIds` from its `configuration` when it
loads, as the values its form starts with, and applies `couponCode` once the subscription is in.

A few more are read once, when the element loads, and a later change does not reach it; to change
one, mount a new element:

- the payment method form's `countryCode` and `configuration.invoiceId`, which it sets up the
  payment methods it offers with;
- the subscription management screen's `configuration.enabledPricingId`, which picks the pricing
  it opens on.

The supported locales are `en-US`, `nl-NL`, `de-DE` and `it-IT`. Any other — `nl` or `en-GB`, say
— renders in `en-US` and logs `UNSUPPORTED_LOCALE`.

### Navigation requests

The SDK does not navigate for you. Where a customer asks to go somewhere — open an invoice, manage a
subscription — the element dispatches an `action-request` event, and your page decides what that
means. The event bubbles and crosses the shadow root, so one listener on a container catches every
element in it:

```ts
import type { RequestActionEvent } from '@solvimon/solvimon-web/core';

container.addEventListener('action-request', (event) => {
    const { detail } = event as RequestActionEvent;

    if (detail.action === 'view-invoice') {
        router.push(`/invoices/${detail.data.invoiceId}`);
    }
});
```

`detail.action` is one of `view-invoice`, `pay-invoice`, `view-subscription-details`,
`view-all-subscriptions`, `manage-subscription`, `edit-billing-information`,
`view-all-payment-methods`, `add-payment-method` and `navigate-to-customer-overview`. None of them
does anything unless you handle it. The event is cancelable so that an action the SDK gives a
default later can be taken over with `preventDefault()`; today that call has no effect.

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

`@import` rules are removed from the overrides: a browser applies them in some cases and not in
others, so load fonts and other stylesheets from your own page instead.

`cssOverrides` is also a property on every element, for a page that registers the elements itself.

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

## Tracing a failure a customer reports

Every log entry carries a `reference` — a short identifier such as `SV-7F3K2A9Q` that is the same
for every entry from one customer's visit. It survives the 3DS redirect and a reload, and names no
customer and no account. When a payment fails, the SDK shows that same reference on the error card
and invites the customer to quote it, so a message saying "it failed, reference SV-7F3K2A9Q" leads
straight to everything that session logged.

Forward it as a searchable tag, and report the thrown value as an exception only when it is one —
anything else arrives in Sentry as "Object captured as exception", with no title and no stack:

```js
onLog: (entry) => {
    Sentry.withScope((scope) => {
        scope.setTag('solvimon.reference', entry.reference);
        scope.setTag('solvimon.code', entry.code);
        scope.setContext('solvimon', entry.context);
        if (entry.fingerprint) scope.setFingerprint(entry.fingerprint);

        if (entry.error instanceof Error) {
            Sentry.captureException(entry.error);
        } else {
            if (entry.error) scope.setContext('solvimon.error', entry.errorSerialized ?? {});
            Sentry.captureMessage(`${entry.code}: ${entry.message}`, entry.level);
        }
    });
};
```

Failed payments are logged with the gateway, the payment acceptor, the payment method type and —
where the failure came back from the Solvimon API — the `requestId` from its `X-Request-Id`
response header, which is what joins the entry to its server-side logs.

A failed API call rejects with an `ApiError` carrying `statusCode`, `requestId` and, for an input
error, the `field` it belongs to. Every failed request also emits one `REQUEST_FAILED` entry, at
`error` — or at `warn` where the SDK expects that status and handles it, as the token refresh does
with a 401. Alert on the codes the callers emit, such as `SESSION_EXPIRED`, rather than on
`REQUEST_FAILED`, which reports the transport and not what it meant.

<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->

## Error logging

The SDK emits structured log entries via the [`onLog`](#error-logging) callback. Subscribe to receive all log events and filter by `code` for programmatic handling.

### Error codes

| Code                                        | Description                                                        |
| :------------------------------------------ | :----------------------------------------------------------------- |
| `ADYEN_PAYMENT_FAILED`                      | Adyen reported the payment as failed                               |
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
| `INVOICE_PREVIEW_FAILED`                    | Failed to load the invoice preview                                 |
| `NO_PAYMENT_METHODS_AVAILABLE`              | No payment method can be offered to the customer                   |
| `ON_DEMAND_CHARGE_FAILED`                   | Failed to charge the on-demand order                               |
| `ON_DEMAND_ITEMS_LOAD_FAILED`               | Failed to load the on-demand items of the subscription             |
| `PAYMENT_ACCEPTOR_MISSING`                  | Additional details arrived without a payment acceptor id           |
| `PAYMENT_AUTHORIZATION_FAILED`              | Failed payment authorization for payment acceptor with id…         |
| `PAYMENT_DETAILS_CALL_FAILED`               | Failed fetching payment details                                    |
| `PAYMENT_DETAILS_REJECTED`                  | Payment details returned a failed payment                          |
| `PAYMENT_INTEGRATION_INITIALIZATION_FAILED` | Failed to mount Adyen web drop-in                                  |
| `PAYMENT_METHOD_OPTIONS_LOAD_FAILED`        | Failed to load the payment methods that can be offered             |
| `PORTAL_TYPE_NOT_ALLOWED`                   | This element does not accept a portal object of type…              |
| `PROMOTION_CODE_APPLY_FAILED`               | Failed to apply promotion code                                     |
| `PROMOTION_CODE_REMOVE_FAILED`              | Failed to remove promotion code                                    |
| `REQUEST_FAILED`                            | Request failed                                                     |
| `REQUEST_PARSE_FAILED`                      | Failed to parse JSON response                                      |
| `RESOURCE_REVOKED`                          | The portal object is not published                                 |
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

| Code                                 | Description                                                                                                  |
| :----------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `ACTIVE_SCHEDULE_NOT_FOUND`          | No schedule is currently being billed                                                                        |
| `ADYEN_INVALID_CONFIGURATION`        | No environment set for adyen advanced flow, defaulted to live                                                |
| `APPLE_PAY_ACTION_REQUIRED`          | Reserved — not currently emitted                                                                             |
| `APPLE_PAY_FORM_INCOMPLETE`          | Apple Pay authorization stopped: the checkout form is incomplete                                             |
| `INVOICE_PREVIEW_SKIPPED`            | Skipped the on-demand charge invoice preview: no schedule to charge it on                                    |
| `ON_DEMAND_CHARGE_REFUSED`           | The on-demand order was refused or its payment did not go through                                            |
| `PAYMENT_INTEGRATION_NOT_RENDERABLE` | No Adyen payment methods to offer                                                                            |
| `RECURRING_AMOUNT_UNRESOLVED`        | Could not tell the recurring part of the invoice from the one-off part; the mandate states the invoice total |
| `REQUEST_FAILED`                     | Request failed with an expected status                                                                       |
| `TRANSLATION_LOAD_FAILED`            | Failed to load translations for locale…                                                                      |
| `UNSUPPORTED_LOCALE`                 | The locale is not supported, showing en-US instead                                                           |

<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->
