# JavaScript Example

This example shows how to consume the published `@solvimon/solvimon-web` package from plain JavaScript through the public npm registry.

## Install

```sh
npm install
```

## Run

```sh
npm run dev
```

Wallet balances example:

```txt
http://localhost:5173/html/wallets.html
```

The wallet example uses the SDK `TEST` environment. Add customer portal tokens in
`html/wallets.html`, or pass them as query params:

```txt
http://localhost:5173/html/wallets.html?individualToken=...&teamToken=...
```

## What this example does

- imports `createSolvimonCore` from `@solvimon/solvimon-web/core`
- creates a reusable Solvimon core instance
- mounts the published `checkout` screen into a DOM node
- mounts the published `wallet-balances` component in `html/wallets.html`
- passes a `portalObject` directly to the component mount
- passes checkout-specific `configuration`

## Update before use

In [index.html](./index.html), replace the placeholder `checkoutPortalObject` with a real checkout portal object returned by your backend.

## Minimal integration snippet

```html
<script type="module">
    import { createSolvimonCore } from '@solvimon/solvimon-web/core';

    const solvimon = createSolvimonCore({
        environment: 'DEV',
        locale: 'en-US',
        logLevel: 'info',
    });

    const unmount = solvimon.createScreen('checkout', {
        container: document.getElementById('sdk-root'),
        portalObject: checkoutPortalObject,
        configuration: {
            email: 'john@example.com',
            countryCode: 'NL',
        },
    });
</script>
```
