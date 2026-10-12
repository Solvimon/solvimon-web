[← Developer Documentation](readme.md)

# Testing

How the unit and end-to-end suites are wired, and what to know before a test you write can be trusted. What the e2e harness mocks and why is described under [End-to-end tests](../../CONTRIBUTING.md#end-to-end-tests) in the contributing guide.

## Unit tests

`vitest.setup.ts` mocks two modules for every spec. Both stay close enough to production that a spec can fail on what they hide.

- **`useIntl` from `@solvimon/solvimon-ui`** formats with `@formatjs/intl` over `src/translations/locales/en-US.json` (`src/test-utils/useIntlMock.ts`). Plurals, selects, dates and tags render as they do for a customer, and the catalogue wins over the `defaultMessage` at the call site. A message that does not parse, a placeholder without a value or a tag without a handler throws, where production would log it and render the message verbatim. An id missing from the catalogue falls back to its `defaultMessage`, as in production.
- **`@/components/providers`** is `createProviderMock()` from `src/test-utils/providerMock.ts`. Its logger is the shared `providerMockLogger`, cleared before each test, so a spec can assert on what was logged:

    ```ts
    import { providerMockLogger } from '@/test-utils/providerMock';

    expect(providerMockLogger.error).toHaveBeenCalledWith('INVALID_EMAIL', expect.any(String));
    ```

A spec that mocks either module itself replaces the global mock for its own file.

Restore fake timers in an `afterEach`, not at the end of the test: a failing assertion skips the rest of the test and leaves fake timers on for every test after it.

ESLint lints specs too, with `consistent-type-assertions` and `no-explicit-any` turned off for them.

## End-to-end tests

The suite runs against the built package, not the sources: build before running it.

```sh
npm run build:css && SOLVIMON_INTERNAL_ENVIRONMENTS=1 npx vite build
npm run test:e2e
```

### Port

The test app listens on 5273. Set `PLAYWRIGHT_PORT` to move it, for example to run suites from two checkouts side by side:

```sh
PLAYWRIGHT_PORT=5874 npm run test:e2e
```

Outside CI, Playwright reuses a server that is already listening on that port. `tests/playwright/global-setup.ts` asks it which checkout it serves and fails the run when it is not this one, rather than letting the suite pass or fail against another checkout's build.

### Running e2e tests from a second checkout

`tests/app` depends on the SDK as `file:../../`, so `tests/app/node_modules/@solvimon/solvimon-web` is a link to whichever checkout ran `npm ci --prefix tests/app`. A git worktree that links `tests/app/node_modules` to the main checkout's therefore tests the main checkout's `dist`. The test app's Vite config refuses to start when the package resolves outside the checkout it runs from.

Without a working `npm ci`, give the worktree a `tests/app/node_modules` of its own that links everything but the SDK back to the main checkout. From the worktree root:

```sh
MAIN=/path/to/main/checkout
mkdir -p tests/app/node_modules/@solvimon
for entry in "$MAIN"/tests/app/node_modules/* "$MAIN"/tests/app/node_modules/.bin; do
    [ "$(basename "$entry")" = "@solvimon" ] || ln -s "$entry" tests/app/node_modules/
done
ln -s ../../../.. tests/app/node_modules/@solvimon/solvimon-web
```

A worktree that links the root `node_modules` to the main checkout's runs vitest as-is: `vitest.config.ts` allows the link's target explicitly, since Vite serves nothing outside the workspace root by default.

### Waiting for what a test asserts on

A screen is visible before every call behind it has been made. Some calls start only once an earlier one has answered, and the screen stops loading as soon as any of its initial calls fails. Assert on a call through `api.waitForCall(name)`, not `api.lastCall(name)`, unless the test has already waited for something that cannot happen before that call.

Do not sleep to show that something did not happen. Wait for the outcome the screen shows instead, such as the error after a rejected card, and then assert on the calls.

### Clicking more than once

solvimon-ui's `Button` ignores a click that lands within 500ms of the previous one. Clicks fired back to back therefore never reach the SDK, and a test that a screen submits only once passes whatever the screen does. Use `clickRepeatedly(button, times)` from `tests/playwright/support/screen.ts`, which spaces the clicks past that window, and make the mocked response slower than all the clicks together.

## Commit hooks

The pre-commit hook runs lint-staged with `--no-stash`, so its backup never enters the stash list that every worktree of the repository shares.

lint-staged still sets aside the unstaged changes of a partially staged file, in `lint-staged_unstaged.patch` in the worktree's git directory. It puts them back itself when the commit goes through. When a task fails it does not, so the hook applies that patch to the working tree and the staged changes stay staged. A task that failed leaves the fixes it already made in the working tree, without rolling them back.

If the patch no longer applies, the hook keeps it under a timestamped name next to the original and says so. Apply it by hand with `git apply --unidiff-zero <file>`; lint-staged writes it without context lines.

Git hooks run from the `core.hooksPath` that husky set up. When that is an absolute path into the main checkout, a worktree runs the main checkout's hooks, so a change to `.husky/` only takes effect there once it is merged.
