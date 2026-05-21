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

| Level | When to use |
| :---- | :---------- |
| `error` | Something failed that the consumer should know about — payment errors, failed fetches, invalid config |
| `warn` | Something is degraded but the SDK recovered — missing optional config, fallback values used |
| `info` | Lifecycle events useful for tracing a user flow — component mounted, payment started |
| `debug` | Verbose detail only useful while debugging — raw API payloads, intermediate state |

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

## Adding a new log code

1. Add the code string to `ErrorCode` or `WarnCode` in [LoggerProvider.types.ts](../../src/components/providers/LoggerProvider/LoggerProvider.types.ts).
2. Use it in the source file via `logger.error` or `logger.warn`.
3. Run the extraction script to update the README:

```sh
npm run logs:list
```

## Updating the README log-code reference

The `## Error logging` section in the root README is auto-generated. Never edit it by hand — it is surrounded by `DO NOT EDIT` markers. To regenerate it after adding or changing log calls:

```sh
npm run logs:list
```

The script scans all `src/**/*.{ts,vue}` files (excluding `.spec.` files), extracts every `logger.error` and `logger.warn` call, deduplicates by code, and replaces the marked section in `README.md`. Commit the updated README alongside your code change.
