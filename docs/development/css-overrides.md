[← Developer Documentation](readme.md)

# CSS Overrides

Customers can pass `cssOverrides` to the SDK to style parts of our components. These styles target public `sv-*` classes inside the SDK shadow root.

This page explains how to add those classes when building new SDK screens or components.

## Main rule

`sv-*` classes are public styling hooks for customers. Do not use them for our own styling.

Use Tailwind and UI library props for Solvimon styling. Use `sv-*` classes only to expose stable hooks for customer overrides.

## Root classes

Every public screen should have:

```vue
class="sv-{screen-name} sv-root sv-screen"
```

Why:

- `sv-{screen-name}` lets customers target one specific screen.
- `sv-root` lets customers target every mounted SDK entry.
- `sv-screen` lets customers target all full-page SDK entries.

Example:

```vue
<ContentWithAsideLayout class="sv-checkout sv-root sv-screen">
    ...
</ContentWithAsideLayout>
```

Every public component should render these classes on its real root HTML element:

```vue
class="sv-{component-name} sv-root sv-component"
```

Why:

- `sv-{component-name}` lets customers target one specific component.
- `sv-root` lets customers target every mounted SDK entry.
- `sv-component` lets customers target all standalone SDK component entries.

Sometimes the public component owns the DOM node directly:

```vue
<Section class="sv-payment-methods sv-root sv-component">
    ...
</Section>
```

Sometimes the public component passes the classes to an inner component:

```vue
<CustomerWalletBalancesBlock class="sv-wallet-balances sv-root sv-component" />
```

Both are fine. The important part is that the browser DOM contains one stable root hook for the public SDK component.

The CSS is written by customers and runs in the browser. It can only match real DOM classes. If the class stays on a Vue component that does not render it to the DOM, the override will not work.

## Naming

Use BEM-style names with the `sv-` prefix.

| Type          | Pattern                          | Example                        |
| ------------- | -------------------------------- | ------------------------------ |
| Block         | `sv-{block}`                     | `sv-checkout`                  |
| Element       | `sv-{block}__{element}`          | `sv-checkout__submit`          |
| Modifier      | `sv-{block}--{state}`            | `sv-checkout--paid`            |
| Shared state  | `sv-{state}`                     | `sv-loading`, `sv-error`       |
| Shared action | `sv-action sv-action--{variant}` | `sv-action sv-action--primary` |

Use kebab-case for all names.

## Where to put classes

Put classes on stable DOM nodes.

Good:

```vue
<div class="sv-checkout__order-summary">
    <OrderSummary />
</div>
```

Bad:

```vue
<Skeleton class="sv-checkout__order-summary">
    <OrderSummary />
</Skeleton>
```

`Skeleton` can render only its slot content, so the class may not appear in the DOM. Customer CSS can only target classes that are actually rendered.

Avoid putting public hooks on components that render a fragment, text node, teleport, or slot-only output. Vue may not place the class in the DOM.

If a component does not have a stable root element, add a small wrapper:

```vue
<div class="sv-checkout__payment-form">
    <PaymentIntegrationForm />
</div>
```

## Actions

Buttons and clickable commands should get shared action hooks plus a specific hook when useful.

Good:

```vue
<Button
    variant="primary"
    class="sv-action sv-action--primary sv-action--full-width sv-checkout__submit"
>
    ...
</Button>
```

Bad:

```vue
<Button variant="outline" class="sv-action sv-action--primary">
    ...
</Button>
```

The `sv-action--primary` class should match the action intent or button variant. Do not add it to every button by default.

Use:

- `sv-action` for all SDK actions
- `sv-action--primary`, `sv-action--secondary`, or `sv-action--ghost` for the action variant
- a specific class like `sv-checkout__submit` when customers may want to style only that button

## Loading and error states

Expose loading and error states with shared classes:

```vue
<!-- Loading state inside a component -->
<Skeleton class="sv-payment-methods__list sv-loading" />

<!-- Error state inside a screen -->
<ErrorNotification class="sv-upgrade-subscription__error sv-error" />
```

Use a block-specific class together with `sv-loading` or `sv-error` when the state belongs to one part of a screen or component.

This lets customers choose how broad the override should be:

```css
/* All SDK loading states */
.sv-loading {
    opacity: 0.7;
}

/* Only the payment methods list loading state */
.sv-payment-methods__list.sv-loading {
    min-height: 300px;
}
```

## Adding new hooks

When adding a new public screen or component:

1. Add the root `sv-*` classes.
2. Add element classes for important sections, lists, forms, buttons, empty states, and totals.
3. Use shared classes for actions, loading, and error states.
4. Keep the class name tied to the user-facing part, not the current implementation.
5. Check that the class appears in the rendered shadow DOM.

Example:

```vue
<Section class="sv-invoices-list sv-root sv-component">
    <InvoiceTable class="sv-invoices-list__table" />
    <Button class="sv-action sv-action--secondary sv-invoices-list__load-more">
        ...
    </Button>
</Section>
```

## Do not expose internal details

Do not create hooks for Tailwind classes, layout helpers, or temporary implementation details.

Avoid names like:

- `sv-flex-row`
- `sv-gray-card`
- `sv-padding-wrapper`

Prefer names that describe what the customer sees:

- `sv-order-summary__total`
- `sv-payment-methods__empty`
- `sv-invoices-list__load-more`

## Documentation

Customer-facing usage belongs in:

- `README.md`
- `src/public/core/README.md`

Contributor rules belong in this file.

## Review checklist

Before merging a new public screen or component, check:

- Does the public screen or component have the correct root classes?
- Do important customer-facing parts have clear `sv-*` element classes?
- Are action classes matched to the real action variant?
- Are loading and error states exposed when customers may need to style them?
- Are hooks on real DOM nodes, not lost on fragment or slot-only components?
- Are class names based on what the customer sees, not on internal layout or Tailwind classes?
