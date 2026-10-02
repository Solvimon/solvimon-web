[← Developer Documentation](readme.md)

# Logging

The SDK ships a structured logger that every component and composable uses. Consumers receive log entries via the `onLog` callback on `LoggerProvider`. This document covers how to log inside the codebase and how to keep the public log-code reference in the README up to date.

## How it works

`LoggerProvider` creates a `Logger` instance and makes it available via Vue's `provide/inject`. Any component or composable in the tree calls `useLogger()` to get it:

```ts
const logger = useLogger();

logger.error('PAYMENT_FAILED', 'Payment authorization failed', { orderId }, err);
logger.warn('ADYEN_INVALID_CONFIGURATION', 'No environment set, defaulted to live');
logger.info('CHECKOUT_INITIALIZED', 'Checkout component initialized');
logger.debug('DEBUG_CODE', 'Raw payload', { payload });
```

When no `LoggerProvider` is in the tree, `useLogger()` returns a no-op so internal code never crashes in isolation.

## Log levels

| Level   | When to use                                                                                           |
| :------ | :---------------------------------------------------------------------------------------------------- |
| `error` | Something failed that the consumer should know about — payment errors, failed fetches, invalid config |
| `warn`  | Something is degraded but the SDK recovered — missing optional config, fallback values used           |
| `info`  | Lifecycle events useful for tracing a user flow — component mounted, payment started                  |
| `debug` | Verbose detail only useful while debugging — raw API payloads, intermediate state                     |

The default minimum level is `warn`. Consumers can lower it via the `logLevel` prop on `LoggerProvider`.

## Rules for logging

These rules are enforced by ESLint and exist to keep the log-code extraction script reliable.

**Always assign the full logger to `logger`.**

```ts
// ✅ correct
const logger = useLogger();

// ❌ destructuring breaks static extraction
const { error } = useLogger();
const { error } = logger;
```

**Always call methods directly on `logger`.**

```ts
// ✅ correct
logger.error('CODE', 'message');

// ❌ optional chaining — use `if (logger)` if the value may be undefined
logger?.error('CODE', 'message');

// ❌ bracket notation
logger['error']('CODE', 'message');
```

**The first argument (code) must be a plain string literal.**

```ts
// ✅ correct
logger.error('PAYMENT_FAILED', 'Payment failed');

// ❌ variable — the extractor cannot see it
logger.error(code, 'Payment failed');
```

**The second argument (message) must be a string or template literal.**

```ts
// ✅ correct
logger.error('INVALID_COUNTRY_CODE', `Invalid country code: ${code}`);

// ❌ variable
logger.error('INVALID_COUNTRY_CODE', message);
```

**Pure utility functions** that are not composables cannot call `useLogger()` (no Vue context). Accept `logger: Logger` as a required parameter and let call sites pass it in:

```ts
// util.ts
export function doSomething(input: string, logger: Logger) {
    logger.warn('SOMETHING_WRONG', 'Unexpected input');
}

// component.vue
const logger = useLogger();
doSomething(input, logger);
```

## Pass the error as the fourth argument, not in the context

`logger.error(code, message, context, err)` reads the thrown value from its **fourth** parameter.
That is what fills `entry.error` and `entry.errorSerialized`, and a consumer forwarding failures to
their reporter sends `entry.error`. An error tucked into the context instead arrives as one more
context field, and the entry looks to them like a message with no exception behind it:

```ts
// ✅ the failure reaches the consumer as a failure
logger.error('PAYMENT_AUTHORIZATION_FAILED', 'Payment authorization failed', context, error);

// ❌ entry.error is undefined — captureException(entry.error) reports nothing
logger.error('PAYMENT_AUTHORIZATION_FAILED', 'Payment authorization failed', { error });
```

This is worth being deliberate about: it is how a whole class of live payment failures came to be
invisible in Sentry while the SDK believed it was logging them.

## Never log what the payment carries

Payment callbacks hand over the credential alongside the detail worth logging — an Adyen state's
`paymentMethod`, an Apple Pay event's `payment.token.paymentData`, a redirect's `redirectResult`.
Log the shape, never the payload:

```ts
// ✅
logger.info('APPLE_PAY_AUTHORIZED', 'Apple Pay authorized', {
    hasPaymentData: !!event.payment.token.paymentData,
});

// ❌ ships an encrypted payment credential and the billing contact to the consumer's log sink
logger.info('APPLE_PAY_AUTHORIZED', 'Apple Pay authorized', { event });
```

The same goes for the customer's own details: a billing contact is a name and an address.

## Logging a failed payment

Failed payments go through `createPaymentFailureContext` in [paymentFailure.ts](../../src/utils/paymentFailure.ts),
which builds the context every gateway failure is logged with — the gateway, the payment acceptor,
the variant, the session reference, a fingerprint, and the `requestId` and status code lifted off a
failed API call. Each gateway form wraps it in a local `failureContext` that fills in what the form
already knows:

```ts
logger.error(
    'PAYMENT_AUTHORIZATION_FAILED',
    `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
    failureContext({ reason: 'PAYMENT_AUTHORIZATION_FAILED', cause: error }),
    error,
);
```

The helper deliberately does not call the logger itself: the code has to stay a string literal at
the call site, or `npm run logs:list` cannot find it.

Two rules for these paths. **Every failure the customer can see is logged** — a path that renders
the error card and emits nothing leaves support with a screenshot and no entry to match it to. And
**every failure the customer can see leaves through `emitError`**, which stamps the error with the
session reference so the card can show it.

## The session reference

`getSessionReference()` in [sessionReference.ts](../../src/utils/sessionReference.ts) returns a short
identifier for the visit — `SV-7F3K2A9Q` — created on first use and kept in `sessionStorage` so it
survives the 3DS round trip and the error card's reload. Every `LogEntry` carries it, and the error
card shows it to the customer.

Its alphabet leaves out `I`, `O`, `0` and `1`, so a reference read down a phone line or retyped from
a screenshot comes back as the one that was issued.

## Grouping entries with a fingerprint

A `code` alone is a coarse grouping key. Where one misconfigured merchant would otherwise show up as
one issue per invoice — or every merchant's problem would pile into a single issue — pass a
`fingerprint` on the context and the logger lifts it onto the entry as a field of its own:

```ts
logger.error('NO_PAYMENT_METHODS_AVAILABLE', 'No payment method can be offered to the customer', {
    fingerprint: ['NO_PAYMENT_METHODS_AVAILABLE', paymentAcceptorId],
    paymentAcceptorIds,
    integrationIds,
    invoiceId,
});
```

Consumers receive it as `entry.fingerprint` and can hand it straight to their reporter — Sentry's
`fingerprint`, or whatever theirs calls the same thing. It has to be an array of strings; anything
else is dropped rather than passed on as a grouping key. Leave it off when the code already groups
the entry the way it should be grouped.

## Adding a new log code

1. Add the code string to `ErrorCode` or `WarnCode` in [LoggerProvider.types.ts](../../src/components/providers/LoggerProvider/LoggerProvider.types.ts).
2. Use it in the source file via `logger.error` or `logger.warn`.
3. Run the extraction script to update the README:

```sh
npm run logs:list
```

## Updating the README log-code reference

The `## Error logging` section in the root README is auto-generated. Never edit it by hand — it is surrounded by `DO NOT EDIT` markers.

**Nothing hand-written may sit between those markers**, not even a paragraph beside the tables.
`updateReadme` replaces everything from the start marker to the end marker, so prose added inside
survives until the next time anyone runs the script and then disappears without a word. That has
already cost one release its host-facing documentation: the section explaining the log `reference`
was written inside the block and was gone by the time the branch merged. Put narrative sections
above the start marker. To regenerate it after adding or changing log calls:

```sh
npm run logs:list
```

The script scans all `src/**/*.{ts,vue}` files (excluding `.spec.` files), extracts every `logger.error` and `logger.warn` call, deduplicates by code, and replaces the marked section in `README.md`. Commit the updated README alongside your code change.
