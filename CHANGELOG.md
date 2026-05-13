# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.7...HEAD
[0.1.0-alpha.7]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/Solvimon/solvimon-web/releases/tag/v0.1.0-alpha.3
