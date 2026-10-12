[← Developer Documentation](readme.md)

# Playground

A local Storybook-style development environment for iterating on SDK screens and components in real time.

## Setup

Install dependencies once from the **repo root**:

```sh
npm run playground:install
```

The dev server listens on `portal.local`, so point that name at your machine once:

```sh
echo '127.0.0.1 portal.local' | sudo tee -a /etc/hosts
```

## Running

You need two terminals running from the **repo root**:

```sh
# Terminal 1 — watches source files and rebuilds the SDK on every change
npm run watch

# Terminal 2 — starts the playground dev server
npm run playground:dev
```

Then open [https://portal.local:5175](https://portal.local:5175) in your browser.

> **SSL certificate warning** — without a certificate of your own the playground serves a self-signed one, so your browser warns on first visit. In Chrome click **Advanced → Proceed to portal.local**; in Firefox click **Advanced → Accept the Risk and Continue**. To skip the warning, put a trusted certificate for `portal.local` in `playground/.cert/cert.pem` with its key in `playground/.cert/dev.pem`, for example with [mkcert](https://github.com/FiloSottile/mkcert): `mkcert -cert-file playground/.cert/cert.pem -key-file playground/.cert/dev.pem portal.local`.

## Usage

1. Get a portal object from your backend (or use an existing test one).
2. Paste the JSON into the **Portal object** field at the bottom of the sidebar and click **Apply**.
3. Select any screen or component from the sidebar — it mounts immediately.

Switching entries re-mounts automatically. Components that require extra `configuration` (e.g. `invoiceId`, `subscriptionId`) show a configuration editor at the bottom of the canvas — edit the JSON and click **Apply**.

The browser reloads a few seconds after any source file change, once the watch build finishes.

## Adding a screen or component

Add an entry to the appropriate array in `playground/src/registry.ts`:

```ts
// src/registry.ts
export const components: StoryEntry[] = [
    {
        kind: 'component',
        id: 'my-component-name', // matches the registered component ID
        label: 'My Component',
        description: 'What it does.',
        // Optional: shown in the configuration editor, re-applied on each mount
        defaultConfiguration: { someRequiredProp: '' },
    },
];
```

The `id` must match a registered component or screen ID (see `src/public/components/` and `src/public/screens/`).

## File structure

```
playground/
  src/
    registry.ts              — list of all screens and components
    App.vue                  — layout shell: sidebar, portal input, navigation
    components/
      StoryCanvas.vue        — mounts the active entry, shows configuration editor
```
