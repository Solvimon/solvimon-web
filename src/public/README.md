# Public entries

Components that are exposed should be listed in the `public` directory. In the public directory, three sub directories are available: `components`, `screens`, and `core`.

## Core (mount API)

The `core` directory exposes a typed mounting API so consumers can create a shared SDK core with `createSolvimonCore(...)` and then mount components/screens into a container they specify, without using web components directly.

- **Import**: `@solvimon/sdk/core`
- **Usage**: Call `createSolvimonCore(sharedConfig)` once, then use `createScreen(...)` or `createComponent(...)` with a container and typed per-view configuration. Returns an `unmount` function.
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
