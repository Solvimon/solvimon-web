# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.4...HEAD
[0.1.0-alpha.4]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/Solvimon/solvimon-web/releases/tag/v0.1.0-alpha.3
