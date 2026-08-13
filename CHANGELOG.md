# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.17] - 2026-08-13

### Added

- Added a Subscription Details screen showing a subscription's plan, wallet balances, and the upgrades available on it.
- Added a Subscription Management screen where customers can change the plan a running subscription is on, with an order summary that prices the change before it is committed and a confirmation once it goes through.
- Added wallet top-ups: customers can top up a balance from the customer overview and see what the top-up will be invoiced for before paying.
- Added the ability to apply a promotion code during checkout, including codes supplied up front.
- Added a modal for adding a payment method, so a customer adding one mid-flow keeps the choice they were making.
- Added a payment method selector for choosing between saved payment methods.
- SDK logs are now mirrored to the browser console outside production.

### Changed

- Upgrading is now offered per pricing on the Subscription Details screen instead of by a single button on the subscriptions list. The list's `showUpgradeButton` configuration option has been removed along with it.
- The Upgrade Subscription screen is now called Subscription Management.
- The payment method form can now be driven by the surrounding screen, which can submit it, hide its button, and set its title.
- Adding a payment method is now only offered when the customer has methods available to add; otherwise the selector says none are available.
- Wallet balances are now rendered with the shared Solvimon UI component.

### Fixed

- Fixed component styles from the Solvimon UI package not reaching the SDK's components, which left parts of the interface unstyled.
- Fixed the checkout silently loading nothing when a subscription's response left out its nested schedule: neither the invoice preview nor the available payment methods appeared, and no error was reported.
- Fixed classes passed to the promotion code section and the seats editor being dropped instead of applied.

## [0.1.0-alpha.16] - 2026-07-28

### Fixed

- Fixed the Stripe payment form failing to load when the portal is embedded inside another site's iframe.

## [0.1.0-alpha.15] - 2026-07-27

### Added

- Added a Payment Methods Management screen where customers can view, add, and manage their saved payment methods.
- Added a Payment Methods list component.
- Added Stripe as a payment provider alongside Adyen across the checkout and payment flows.
- Added the ability to set a default payment method.
- Added an Invoice header that surfaces key invoice summary details.
- Added an optional `name` prop to the payment form.
- Added an `X-Client-Version` header to outgoing API requests.

### Changed

- The pay button now shows a loading state while a payment is being processed.
- Checkout form state is now preserved and restored across payment redirects.
- Express payment methods are now shown only for Adyen.
- The screen aside is now optional.
- Removed the "Continue to merchant" button from the payment flow.
- Improved the authentication mechanism.

### Fixed

- Fixed the Invoice component ignoring its resolved props.
- Fixed list items not resetting when the initial page of data is refetched.

## [0.1.0-alpha.14] - 2026-06-17

### Added

- Added support for on-demand items when upgrading subscriptions.

## [0.1.0-alpha.13] - 2026-05-30

### Fixed

- Fixed the invoice preview not updating when form fields, seat values, or enabled pricing selections change in the checkout flow.

## [0.1.0-alpha.12] - 2026-05-29

### Fixed

- Fixed the payment button remaining disabled after selecting a payment method in the drop-in.

## [0.1.0-alpha.11] - 2026-05-29

### Fixed

- Fixed payment authorization and tokenization incorrectly reporting success when the payment was refused by the gateway.

## [0.1.0-alpha.10] - 2026-05-29

### Changed

- Adyen CSS is now inlined into the bundle instead of loaded via a `<link>` tag, fixing a MIME-type error in consumer apps that don't serve static assets from the SDK.

## [0.1.0-alpha.9] - 2026-05-28

### Added

- Added structured error and warning logging with log-level control via the `logLevel` prop.
- Added `useWatchAsync` composable for watching async operations with reactive loading state.
- Added support for custom CSS class overrides on SDK components.
- Added comprehensive SDK documentation for error codes, warnings, and component usage.

### Changed

- Logger now emits structured log lines instead of raw `console` calls, making it easier to integrate with external log collectors.
- Default log level changed from `info` to `warn` to reduce noise in production.
- Adyen CSS is now loaded lazily via a `<link>` tag injected into the shadow root, avoiding a blocking stylesheet request on page load.

### Fixed

- Fixed translation loading when used with the async guard pattern.
- Fixed a structured-clone bug that caused computed objects to be incorrectly shared across instances.

## [0.1.0-alpha.8] - 2026-05-22

### Added

- Added a pay-invoice screen for processing outstanding invoice payments.
- Added a `PayButton` component for triggering payment actions inline.
- Added a new details object to the payment response for richer post-payment data.
- Added a payments-by-Adyen KPI metric to the billing overview.

### Changed

- Adyen payment integration is now lazy-loaded, reducing the initial bundle size.
- `PaymentHistoryBlock` inside the Invoice component is now lazy-loaded, reducing the initial bundle size.
- Translations are dynamically loaded at runtime instead of being bundled upfront.
- Replaced `lodash` `cloneDeep` with native `structuredClone` and removed the `lodash` runtime dependency.
- Improved JSON parsing robustness in API response handling.
- Refactored payment method selection flow and checkout redirect handling.

### Fixed

- Fixed XSS vulnerability in checkout redirect handling by sanitizing redirect URLs before navigation.
- Fixed security vulnerability in `js-cookie` (CVE-2026-46625, prototype hijack via `assign()`).

## [0.1.0-alpha.7] - 2026-05-13

### Added

- Added tax ID validation to the checkout form. A composable validates the customer's tax ID against the API and displays an inline notice when validation fails.
- Added a playground with all screens and components for local iteration.
- Added TypeScript declaration files to the build output.
- Added a bundle size comparison bot that posts results as a PR comment on every pull request.
- Added a coverage report step to the CI pipeline.
- Added automatic GitHub Release creation with changelog notes on every release tag.

### Changed

- `BillingInformation` component now loads initial customer data on mount instead of requiring the parent to pass it in.
- Lazy-load Adyen CSS to reduce the initial bundle size.
- Switched to tree-shakable `lodash-es` named imports to reduce bundle size.
- Improved the `watch` script to run JS and CSS builds in parallel.

### Fixed

- Fixed `Checkout` filtering seat quantity inputs by the active billing period only.
- Fixed the email field in the billing information form not updating correctly.
- Fixed security vulnerabilities reported by Dependabot.

## [0.1.0-alpha.6] - 2026-05-07

### Changed

- Published a release pipeline test version. No package behavior changes are included in this release.

## [0.1.0-alpha.5] - 2026-05-06

### Fixed

- Fixed Tailwind CSS content paths that were broken after migrating from `@solvimon/tailwind-config`. The old config resolved to a path two directories above the project root and pointed to source files that are not published in the UI package. The config now scans the UI package's compiled `dist/` bundles, restoring all missing utility classes.
- Fixed TypeScript errors caused by breaking API changes in `@solvimon/solvimon-ui` (renamed/removed props, stricter component types).
- Fixed `Checkout` entry component passing props as flat attributes instead of the expected `configuration` object, which caused `avatar`, `email`, `countryCode`, and `enabledPricingIds` to be silently ignored.

## [0.1.0-alpha.4] - 2026-05-05

### Added

- Added changelog enforcement before release tag creation.
- Added automatic `v<version>` release tag creation when the root package version changes on `main`.
- Added a tag-based npm publish workflow for release tags.
- Added publishing documentation for the GitHub Actions release flow.

### Changed

- Split release publishing out of the main CI workflow.
- Simplified the publish workflow to verify the release tag matches the package version before publishing.
- Updated the main README to link to the dedicated publishing documentation.
- Moved publishing documentation to `docs/development/publish.md`.

### Fixed

- Fixed `InvoicesList` not loading its initial invoice data.

## [0.1.0-alpha.3] - 2026-05-05

### Added

- Initial alpha release.

[Unreleased]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.9...HEAD
[0.1.0-alpha.9]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.8...v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.7...v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/Solvimon/solvimon-web/releases/tag/v0.1.0-alpha.3
