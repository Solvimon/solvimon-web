# Public entries

Components that are exposed should be listed in the `public` directory. In the public directory, three sub directories are available: `components`, `screens`, and `core`.

## Core (mount API)

The `core` directory exposes a **mount API** so consumers can define and configure components/screens and mount them into a container they specify, without using web components directly.

- **Import**: `@solvimon/sdk/core`
- **Usage**: Call `createSolvimonMount({ container, config, view })` with your DOM container (or selector), shared config (environment, token, locale, branding), and which screen or component to render. Returns `{ unmount }`.
- See `public/core/README.md` for details.

To add a new public entry, always make sure you at least have the following files:

```txt
public/screens

Checkout.entry.ce.ts        <-- Contains define function
Checkout.entry.vue          <-- Contains the screen/component
Checkout.entry.types.ts     <-- Contains the external types for the screen/component
```

And add an entry to `package.json`

```txt
 package.json

 "exports": {
        ...,
        "./screens/checkout": {
            "types": "./dist/screens/Checkout/Checkout.ce.d.ts",
            "import": "./dist/screens/Checkout/Checkout.es.js",
            "require": "./dist/screens/Checkout/Checkout.cjs.js"
        },
        ...
 }
```

## Components

Components should be added in the `public/components` directory. The definition of a component is that it is single responsibility. Using separate components gives more flexibility but because of that also adds more maintenance.

## Screens

Compositions of multiple components are called screens. These should be placed in the `public/screens` directory. Screens are quick to setup and manage interaction
between components.
