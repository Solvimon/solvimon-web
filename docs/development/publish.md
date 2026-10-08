[← Developer Documentation](readme.md)

# Publishing The SDK

The SDK is published as `@solvimon/solvimon-web` to the public npm registry.

Publishing is automated through GitHub Actions. You do not publish or tag
manually during the normal release flow.

## How Publishing Works

One workflow does all of it: `create-release-tag.yml`, on every push to `main`
that touches `package.json`.

1. Bump the version in the root `package.json`.
2. Add release notes for the same version in `CHANGELOG.md`.
3. Merge the release commit to `main`.
4. The workflow compares the version against the one in the commit it replaced.
   Unchanged, it stops here.
5. It runs `npm run changelog:check`, which insists on a non-empty section for
   that exact version.
6. It checks no `v<version>` tag exists yet.
7. It publishes to npm. `prepublishOnly` runs the publish guard, the changelog
   check, the build, and the bundle and type gates before anything is uploaded.
8. Only once the publish has gone through does it create the `v<version>` tag,
   and then the GitHub release from the matching changelog section.

The order matters: a tag pointing at a version that never reached the registry
is the state a release has to be dug out of by hand.

> **Merging a version bump publishes it.** There is no approval step between the
> merge and npm, and npm versions are immutable — a wrong version cannot be
> replaced, only deprecated and superseded.

## Bumping The Version

From the repository root:

```bash
npm run version:bump
```

This prompts for the bump type. While the version carries a prerelease tag —
every `0.1.0-alpha.*` — **`prerelease` is the one you want**:

| Bump         | `0.1.0-alpha.25` becomes | Note                                    |
| ------------ | ------------------------ | --------------------------------------- |
| `prerelease` | `0.1.0-alpha.26`         | stays in alpha                          |
| `patch`      | `0.1.0`                  | **leaves alpha**, publishes as `latest` |
| `minor`      | `0.1.0`                  | **leaves alpha**, publishes as `latest` |
| `major`      | `1.0.0`                  | **leaves alpha**, publishes as `latest` |

`npm version patch` strips the prerelease tag rather than incrementing it. On an
alpha version, `patch` and `minor` both land on the same stable `0.1.0`, which
then goes to npm under the `latest` tag where every consumer installing the
package without a version will pick it up.

The non-interactive equivalents:

```bash
npm run version:prerelease
npm run version:patch
npm run version:minor
npm run version:major
```

These update `package.json` and `package-lock.json`. They do not tag.

## Release Steps

1. Make your SDK changes.
2. Run `/create-release` in Claude Code — it bumps the version, drafts the
   changelog, and tells you the commit message and files to stage.
3. Commit and open a pull request to `main`.
4. Once it merges, watch the `Create Release Tag` workflow.
5. Verify that the package is on npm and that a `v<version>` tag and GitHub
   release exist.

## Re-running A Release

`Create Release Tag` can be run by hand from the Actions tab — use this when a
publish failed partway. A manual run has no previous commit to compare against,
so it asks the tags instead: it releases the version in `package.json` when no
`v<version>` tag exists yet, and stops when one does. The optional `version`
input is a safety check rather than an override — it must match `package.json`,
and the run fails if it does not.

## Changelog Requirement

Every published version must have a matching changelog section:

```markdown
## [0.2.3] - 2026-05-05

### Added

- Describe the release.
```

The heading must name the version exactly. `## [0.1.0-alpha.25]` is not a
section for `0.1.0`, and a release whose section is missing or empty is not
published.

```bash
npm run changelog:check
```

## What Gates A Publish

`prepublishOnly` runs before npm receives anything:

| Gate                    | What it holds                                          |
| ----------------------- | ------------------------------------------------------ |
| `publish:guard`         | refuses to publish from anywhere but CI                |
| `changelog:check`       | the version has release notes of its own               |
| `build`                 | type-check and a clean production build                |
| `bundle:check-contents` | no internal hostname reached the bundle                |
| `types:check-published` | the published declarations resolve for a consumer      |
| `types:check-consumer`  | a fixture consumer compiles against the packed tarball |

CI runs the same checks on every pull request, plus the e2e suite against the
build that gets published.

## Required GitHub Secrets

| Secret             | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `GITLAB_NPM_TOKEN` | GitLab token for installing private `@solvimon/*` dependencies  |
| `NPM_TOKEN`        | npm access token with publish rights to the `@solvimon` npm org |

Tagging and the GitHub release use the workflow's own `GITHUB_TOKEN`, granted
`contents: write` in the workflow itself. No separate release token is needed.

## Node Version

CI and the publish run on the version in `.nvmrc`. `package.json` declares the
floor consumers need in `engines.node`.

## Consuming The SDK

```bash
npm install @solvimon/solvimon-web
```

## Troubleshooting

If the SDK does not publish after merging a version bump:

1. Check whether the merged commit changed the root `package.json` version — the
   workflow only runs for pushes that touch `package.json`.
2. Check whether `CHANGELOG.md` has a section naming that exact version.
3. Check whether `v<version>` already exists as a tag.
4. Check whether `NPM_TOKEN` has publish access to `@solvimon/solvimon-web`.
5. Check whether that version is already on npm. Versions are immutable and
   cannot be republished.
6. Read the `Create Release Tag` run; a failed `prepublishOnly` gate shows there.
