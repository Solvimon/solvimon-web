# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The access token now refreshes, instead of the session ending five minutes in. Identity renews a session from a `refresh-token` cookie it sets on `/oauth/token` and reads back on `/oauth/refresh-token`; the SDK sent both calls with `credentials: 'omit'`, under which the browser discards that cookie from the response and sends none on the refresh. Every refresh answered 401, and `AuthProvider` gave up and raised `SESSION_EXPIRED` once the first token expired. Both identity calls now pass `credentials: 'include'`. Every other request keeps omitting credentials, which is still the default.

## [0.1.0-alpha.25] - 2026-10-06

### Added

- The SEPA Direct Debit mandate now also states the refund rights a customer holds against their own bank: that they are entitled to a refund under the terms of their agreement with that bank, that a claim must be made within 8 weeks of the date the account was debited, and that the bank can supply a statement explaining those rights. The rights are held against the customer's own bank rather than the party collecting the money, so the wording reads the same whether or not the screen knows the billing entity to name.

## [0.1.0-alpha.24] - 2026-10-05

### Added

- The Adyen SEPA Direct Debit form now carries the direct debit mandate — a heading and the authorisation itself, naming the billing entity collecting the money — inside Adyen's own card under the IBAN field, where a customer reads it as they enter the account it applies to. Where the billing entity is not known to the screen, the mandate falls back to wording that does not need the name rather than leaving a gap in the sentence. It appears on no other payment method. Adyen offers no SEPA consent string to override and no slot in that card, so the notice is placed into it and re-placed if Adyen rebuilds the card; the selector that depends on Adyen's internals is pinned by a test, so an upgrade that moves it fails the build rather than quietly dropping a legal notice.
- The checkout screen shows the terms and conditions a merchant set on the checkout page, in a footer under the payment form and order summary, where a customer sees them before paying rather than after. They support the subset the Desk editor can produce — text, bold, italic, underline and hyperlinks — and are rendered as components rather than as markup, so a note can never inject anything into a customer's checkout. Anything outside that subset, a raw tag included, shows as the text it is, and a link the browser should not follow keeps its words and loses its href. A checkout page with no note looks exactly as it did — the footer is not rendered at all.

### Changed

- `ContentWithAsideLayout` takes an optional `footer` slot, rendered full width below the content and aside columns. Screens that pass none render exactly as before.
- A failed API call now rejects with an `ApiError` rather than a plain object. It carries the same `statusCode`, `requestId` and `field` as before, and adds what an object literal could not: a name, a message and a stack. A host forwarding it to their reporter was getting "Object captured as exception with keys: field, hasError, message, requestId, statusCode" as the title of their most important issue; it now reads as the error it is. An error body with no message of its own falls back to `Request failed with status <code>` instead of an empty one.

### Fixed

- A request failure that the SDK handles no longer also reports as an anonymous `UNHANDLED_ERROR`. Every failed request was raised through the UI library's error channel as well as being handled by its caller, and came out under the same codeless code whether it was a declined payment, an expired session or a dropped connection — carrying no status, no request id and no useful stack. Hosts ended up alerting on that entry rather than on the one that said what had happened. A failed request now emits a single `REQUEST_FAILED` entry carrying the method, path, status code and request id, grouped by endpoint and status.
- The token refresh answering 401 no longer raises an error-level entry. It is the expected end of a session, and `AuthProvider` already reports `SESSION_EXPIRED` once it is sure — which is the entry worth waking someone. A caller declares such a status with `expectedStatusCodes`, and the failure drops to `warn` while still rejecting.
- The README's guidance on wiring `onLog` to a reporter is back, and this time outside the auto-generated log-code block that had silently eaten it. It now also guards against reporting a non-`Error` as an exception.

## [0.1.0-alpha.23] - 2026-10-02

### Added

- A failed payment now shows the customer a reference such as `SV-7F3K2A9Q`, with a button to copy it, and asks them to quote it to support. The same reference is on every log entry the visit emits, as `reference`, so one a customer sends leads straight to everything that session logged. It is kept for the browser session, so it survives the 3DS redirect and the error card's own reload, and identifies nothing but the visit.

### Changed

- `LogEntry` carries a required `reference`. A host that only reads entries is unaffected; one that constructs a `LogEntry` of its own — in a test double, say — now has to supply it. The schema version stays at 1, since no existing field changed meaning.

### Fixed

- Failed payments reach `onLog` again. Several paths rendered the error card and emitted nothing at all — the Adyen drop-in reporting a failed payment among them — and those that did log passed the caught error as context rather than as the error, so entries arrived with `error` and `errorSerialized` empty and a host forwarding them to their reporter sent an exception with nothing in it.
- A failed payment is now logged with the gateway, the payment acceptor, the payment method type and, where the Solvimon API refused the call, the `requestId` from its `X-Request-Id` header, which is what joins the entry to its server-side logs.
- The error card tells the customer what actually failed. Every gateway failure was shown as "Something went wrong — an unknown error has occurred", whether the card was declined, the form failed to load or the session had expired.
- The error card is translated. Its titles and messages were hard-coded English and appeared untranslated inside an otherwise localised checkout.
- Three failures that left the customer with no answer now say so: a payment whose details could not be confirmed, which used to leave a spinner that never resolved; a drop-in that failed to mount, which used to leave an empty container; and a drop-in error, which told the screen nothing and so left the pay button spinning for good — it now reaches `payment-failed` like any other failure.
- Apple Pay no longer puts the payment credential in the log. The authorized event was logged whole at `info` level, carrying the encrypted Apple Pay token and the customer's billing contact into the host's log sink; only the shape of what arrived is logged now.

## [0.1.0-alpha.22] - 2026-09-29

### Added

- The checkout now lets a customer choose how many units of a one-off flat item to buy, using a stepper under the seats editor that works the same way. The quantity reprices the invoice preview and is carried into the subscription created at payment. A plan with no such items sends the same requests as before.

### Changed

- A downloaded invoice PDF is now named after the invoice number the customer reads on the document — `invoice-INV-001.pdf` rather than `invoice-inv_01abc....pdf`. The download service takes the invoice it is downloading instead of just its id, and an invoice still waiting for a number falls back to that id.

### Fixed

- The seat and unit counts in the checkout steppers are visible again. Text and feedback elements from `@solvimon/solvimon-ui` had lost their colours, and in the steppers that left the count transparent.

## [0.1.0-alpha.21] - 2026-09-28

### Added

- The payment method form now reports when it has finished. A host driving its own footer can read `isCompleted` and hide the built-in button, and `configuration.successRedirectUrl` — declared until now but read by nobody — puts a Continue button on the confirmation rather than navigating on its own.

### Changed

- Moved to `@solvimon/solvimon-ui` 1.9.1, a patch that leaves the component API as it was. One surface shifts with it: the invoice summary rows carry a smaller text size than before.
- The subscription details screen now loads its schedules on demand rather than up front, which is a fifth less for a host to download to mount it. The schedules only ever rendered once the subscription had arrived, so nothing appears any later than it did.
- The checkout now loads its plan customization editor on demand rather than up front, which is a twentieth less for a host to download to mount it. The editor only ever rendered once the subscription had arrived, so nothing appears any later than it did.
- The Adyen SDK is now loaded through a single entry point, so a bundler can drop the exports the SDK never reaches for. The shared chunk behind every screen that mounts a payment form goes from 581 kB to 444 kB raw, and from 160 kB to 126 kB gzipped.

### Fixed

- A screen is no longer mounted twice while its translations load. Each one was built against the English fallback, then thrown away and built again once its catalogue arrived, so a single checkout asked for two subscriptions, two invoice previews and two sets of payment method options — and the first of each priced a screen the customer never saw. A screen now renders once its catalogue is in, and asks for what it needs once.
- The checkout no longer starts filled in with details from a previous visit. Restoring a form after a payment return failed part way through and left the stored state behind, so the next checkout in that tab silently carried the entries of the one before it.
- The checkout now tells the host about an email address or country code it cannot use. Both were rejected in silence — the value dropped and the field left empty — so an integrator had nothing to go on. A read-only email the checkout rejected also locked an empty field, leaving the customer unable to enter one at all.
- A checkout no longer asks the gateway twice for the payment methods on offer when the country and the amount land in the same tick. A lookup now joins one already in flight for the same request.
- Storing a payment method now updates the list on the payment methods screen. The card previously appeared only after a page reload, on the one screen whose purpose is adding them.
- An invoice that has already been paid is no longer offered a pay button reading €0.00, which threw when pressed.
- Following a payment link to an invoice that cannot be loaded now shows the error. The customer was left on an empty screen with no sign of whether the link was wrong, the invoice gone, or the page still loading.
- Stripe now keeps a card only where the customer said it could. The option that stores the method was set on every payment regardless of the answer, so the pay-invoice checkbox changed nothing. Whether the method is ultimately stored also depends on the API honouring what the payment was created with.
- The payment method form no longer offers a save once the method is stored. The gateway swaps its fields for a confirmation, but the submit button sits a level up and stayed put — most visible with SEPA, which completes without ever leaving the page.
- The success card no longer promises a redirect that is not coming. Only a checkout goes on to redirect; paying an invoice and storing a payment method both end on that card and stay put.
- The SDK no longer writes stray `console` output when loaded as ES modules. Those statements were only ever stripped from the CommonJS build, so the console noise an integration saw depended on which format its bundler picked. Logging through `onLog` and the `log` event is unaffected. The published package is also a tenth smaller to install.

## [0.1.0-alpha.20] - 2026-09-23

### Added

- Paying an invoice now asks whether to keep the payment method. The checkbox is offered ticked, and the one authorization that pays the invoice stores the method with it, so the next invoice can be paid without entering the card again. Unticking it pays the invoice and stores nothing — where the method was stored regardless before.
- Log entries can carry a `fingerprint`, so a consumer forwarding them to their own reporter can group by something narrower than the log code — a misconfigured merchant as one issue rather than one per invoice.
- German (`de-DE`) and Italian (`it-IT`) are now supported locales, fully translated and selectable wherever `en-US` and `nl-NL` already were.

### Changed

- Moved to the `@solvimon/solvimon-ui` 1.9.0 component API, which replaces `Typography`'s `shade` and `Button`'s `color`/`variant` with the semantic `color` and `intent` roles, and the same on `Chip`. Two surfaces shift with it: the invoice table loses its zebra striping and row hover, which the table now decides for itself, and the VAT check button is no longer green, there being no green intent to map it to.
- The invoice table's pay button is now sized to the status chip it stands in for, so the status column keeps one height from row to row.

### Fixed

- A payment gateway that offers no payment methods no longer renders as a blank region. Adyen's drop-in is not mounted when there is nothing to put in it, and the pay-invoice and payment-method-form surfaces say the payment cannot be taken — naming the seller and offering the invoice download — instead of showing an empty form. They also tell loading apart from unavailable, rather than rendering both the same way.
- The promotion code toggle's aria label is now translatable. It built its message and id with a ternary, so FormatJS never extracted either string and the label stayed English in every locale.

## [0.1.0-alpha.19] - 2026-09-03

### Added

- The published package now carries its own type declarations, so building against the SDK no longer requires access to Solvimon's private type packages.
- Pricing plan schedules now show the price customizations that apply to them.
- Added the z-index steps the shared Tailwind config was missing.

### Changed

- Each entry is now loaded on demand and exposes a single export, so a host only pays for the screens and components it actually mounts.
- The shared UI library is now split per entry, which cuts what mounting a single screen pulls in.
- The checkout now confirms a successful sign-up only once the payment has gone through.
- Removed the superseded subscription management screens, along with a number of components nothing mounted: the placeholder components, the payment provider form, the invoice block content components and the customer billing information block.
- Consolidated duplicated internals — one way to read pricings off a schedule, one payment method options composable, one custom element factory, one query string builder, one shell for both wallet modals and one contract for the gateway forms — with no change to behavior.

### Fixed

- Fixed every entry the registry can mount being reachable in the published package, and ESM and CJS entries now carry the file extensions that identify them.
- Fixed the published type declarations not resolving for a consumer.
- Fixed a refreshed access token not being applied, and the token now being read per request.
- Fixed API error messages being reported as a parse failure, and every response now has its media type and status checked.
- Fixed the payment method lookup failing silently in the checkout, which now reports the failure and offers to retry.
- Fixed a partial configuration dropping the options it left out, and the customer overview not passing its configuration to the payment methods block.
- Fixed the Provider being mounted twice in two entry components.
- Fixed translated strings sharing message ids, so each string is translated on its own.
- Stopped shipping a stylesheet that a consumer could not use, and kept the internal environments out of the published package.

## [0.1.0-alpha.18] - 2026-08-24

### Added

- Added automatic wallet top-ups: a customer can set a balance to top itself back up, choosing the level it may drop to, the amount that buys it back and the payment method to charge, and is asked to confirm before an existing one is switched off.
- Added cancelling and renewing a subscription from inside the SDK, confirmation modal included, so the host no longer has to handle either itself.
- Added deleting a saved payment method.
- The Subscription Details screen now shows the payment method a subscription is billed to.
- A wallet top-up now asks which subscription it is bought for when more than one could carry it, and offers only the on-demand items that subscription actually prices.

### Changed

- A top-up now requires a payment method before it can be charged, and says so plainly when the customer has none to choose from — in the checkout as well as the top-up modal.
- The wallet top-up and automatic top-up flows now step sideways between panes, so a customer who leaves to add a payment method returns to the choice they were part-way through rather than starting it again.
- Expanded resources are now requested with a single "expand all" parameter rather than listing each relation, which means responses carry every expandable relation.
- A subscription now always starts at the moment it is created.
- The delete payment method confirmation now matches the subscription cancellation one.
- Tightened the spacing of empty states and of the rows listing enabled pricings.
- Updated the shared Solvimon UI package to 1.7.8.

### Fixed

- Fixed the payment method error being hidden when the customer had no methods to choose from.
- Fixed an error left over on a modal after it was closed and opened again.
- Fixed a class passed to a modal being dropped instead of applied.
- Fixed reported dependency security advisories.

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
