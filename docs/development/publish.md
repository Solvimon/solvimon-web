[← Developer Documentation](readme.md)

# Publishing The SDK

The SDK is published as `@solvimon/solvimon-web` to the public npm registry.

Publishing is automated through GitHub Actions. You do not create or push release
tags manually during the normal release flow.

## How Publishing Works

1. Bump the version in the root `package.json`.
2. Add release notes for the same version in `CHANGELOG.md`.
3. Merge the release commit to `main`.
4. The `Create Release Tag` workflow detects the `package.json` version change.
5. That workflow runs `npm run changelog:check`.
6. If the changelog is valid, it creates a tag in the format `v<version>`.
7. The `Release` workflow runs for that tag and publishes the package to npm.

Example:

```text
package.json -> "version": "0.2.3"
```

This results in the tag:

```text
v0.2.3
```

## What Triggers A Publish

The publish workflow only runs for tags that match this pattern:

```text
vX.Y.Z
vX.Y.Z-suffix
```

Examples:

- `v0.1.0`
- `v1.4.2-beta.1`

The `Create Release Tag` workflow creates these tags automatically when a
version bump is merged to `main`.

## Release Steps

To publish a new SDK version:

1. Make your SDK changes.
2. Bump the version.
3. Add release notes to `CHANGELOG.md`.
4. Run `npm run changelog:check`.
5. Open and merge a pull request to `main`.
6. Wait for the release tag workflow and publish workflow to complete.
7. Verify that:
    - a tag named `v<version>` was created
    - the package was published to npm

## Bumping The Version

From the repository root:

```bash
npm run version:bump
```

This opens an interactive prompt and lets you choose:

- `patch`
- `minor`
- `major`

You can also use explicit non-interactive commands:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

These commands update `package.json` and `package-lock.json`. They do not create
a Git tag locally. Tag creation is handled by GitHub Actions after the version
bump is merged to `main`.

## Changelog Requirement

Every published version must have a matching changelog section:

```markdown
## [0.2.3] - 2026-05-05

### Added

- Describe the release.
```

The release tag workflow runs:

```bash
npm run changelog:check
```

If `CHANGELOG.md` does not contain a non-empty section for the current
`package.json` version, the tag is not created and nothing is published.

## Required GitHub Secrets

| Secret                       | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `GITLAB_NPM_TOKEN`           | GitLab token for installing private `@solvimon/*` dependencies       |
| `NPM_TOKEN`                  | npm access token with publish rights to the `@solvimon` npm org      |
| `SOLVIMON_WEB_RELEASE_TOKEN` | GitHub token with contents write access, used to create release tags |

`SOLVIMON_WEB_RELEASE_TOKEN` should belong to a company-controlled machine user
or GitHub App. Do not use an individual developer's personal token for this.

## Workflow Responsibilities

`ci.yml` runs on pull requests and validates the change before it is merged.

`create-release-tag.yml` runs on `main` when release metadata changes. It checks
whether `package.json` changed version, verifies the changelog, and creates the
matching `v<version>` tag.

`release.yml` runs on `v*` tags. It installs dependencies, verifies that the tag
matches the `package.json` version, and publishes to npm.

## Consuming The SDK

Consumers can install the SDK directly from npm:

```bash
npm install @solvimon/solvimon-web
```

## Troubleshooting

If the SDK does not publish after merging a version bump:

1. Check whether the merged commit changed the root `package.json` version.
2. Check whether `CHANGELOG.md` contains a section for that exact version.
3. Check whether the `Create Release Tag` workflow created `v<version>`.
4. Check whether `SOLVIMON_WEB_RELEASE_TOKEN` is available to this repository.
5. Check whether `NPM_TOKEN` has publish access to `@solvimon/solvimon-web`.
6. Check whether the same version already exists on npm. npm package versions are immutable.
7. Check the `Release` workflow logs for the tag.
