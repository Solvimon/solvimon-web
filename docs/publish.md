# Publishing The SDK

The SDK is published as `@solvimon/solvimon-web` to the public npm registry.

Publishing is automated through GitLab CI. You do not need to create and push the SDK tag manually.

## How Publishing Works

The SDK has its own release flow, separate from the rest of the monorepo.

1. Bump the version in `packages/sdk/package.json`.
2. Merge that change to `main`.
3. The SDK pipeline detects the version change and creates a tag in the format `sdk-v<version>`.
4. The tag pipeline publishes `@solvimon/solvimon-web` to the public npm registry.

Example:

```text
packages/sdk/package.json -> "version": "0.2.3"
```

This results in the tag:

```text
sdk-v0.2.3
```

## What Triggers A Publish

The publish job only runs for tags that match this pattern:

```text
sdk-vX.Y.Z
sdk-vX.Y.Z-suffix
```

Examples:

- `sdk-v0.1.0`
- `sdk-v1.4.2-beta.1`

Regular repository tags such as `v1.20.0` do not publish the SDK.

## Release Steps

To publish a new SDK version:

1. Make your SDK changes.
2. Bump the SDK version.
3. Merge to `main`.
4. Wait for the SDK pipeline to complete.
5. Verify that:
    - a tag named `sdk-v<version>` was created
    - the package was published to npm

## Bumping The Version

You can bump the SDK version from the repository root or from `packages/sdk`.

From the repository root:

```bash
npm run sdk:version
```

This opens an interactive prompt and lets you choose:

- `patch`
- `minor`
- `major`

You can also use explicit non-interactive commands:

```bash
npm run sdk:version:patch
npm run sdk:version:minor
npm run sdk:version:major
```

From `packages/sdk` directly:

```bash
npm run version:bump
```

Or:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

These commands update `packages/sdk/package.json` only. They do not create a Git tag locally. Tag creation is handled by GitLab CI after the version bump is merged to `main`.

## Notes

- The SDK package is published to the public npm registry, so `packages/sdk/package.json` must remain publishable. That means it must not use `"private": true`.
- `packages/sdk/package.json` sets `publishConfig.access` to `public` and `publishConfig.registry` to `https://registry.npmjs.org/`.
- The SDK bundle includes the internal `@solvimon/solvimon-ui` and `/solvimon-types` packages, so consumers only need access to `@solvimon/solvimon-web`.
- The publish job uses `NPM_RELEASE_BOT_TOKEN` to authenticate against the public npm registry.
- Prerelease versions such as `0.2.0-alpha.1` publish with the `next` dist-tag by default. Stable versions publish with the `latest` dist-tag by default. Set `NPM_DIST_TAG` in CI to override this for a release.
- The auto-tag job uses dedicated CI variables to push tags back to the repository.
- Local `npm publish` is blocked by a guard script. Publishing is only allowed from GitLab CI.

## Required CI Variables

The SDK auto-tag job does not use `CI_JOB_TOKEN` for Git pushes. Instead, configure these protected CI/CD variables in GitLab:

- `RELEASE_BOT_USERNAME`
- `NPM_RELEASE_BOT_TOKEN`
- `NPM_RELEASE_BOT_TOKEN`

Recommended setup:

1. Create a project access token or bot token with permission to push tags to the repository.
2. Give it at least repository write access.
3. Add the token username as `RELEASE_BOT_USERNAME`.
4. Add the token secret as `NPM_RELEASE_BOT_TOKEN`.
5. Create an npm access token with permission to publish `@solvimon/solvimon-web`.
6. Add that token as `NPM_RELEASE_BOT_TOKEN`.
7. Mark all variables as masked and protected.

The publish job uses `NPM_RELEASE_BOT_TOKEN` for the npm registry publish itself.

## Consuming The SDK

Consumers can install the SDK directly from npm:

```bash
npm install @solvimon/solvimon-web
```

### Notes For Consumers

- Consumers do not need a registry token for the public SDK package.
- The SDK now bundles the internal `@solvimon/solvimon-ui` and `/solvimon-types` packages, so consumers only need `@solvimon/solvimon-web`.

## Troubleshooting

If the SDK does not publish after merging a version bump:

1. Check whether `packages/sdk/package.json` was actually changed in the merged commit.
2. Check whether the version already has a tag like `sdk-v<version>`.
3. Check whether `RELEASE_BOT_USERNAME` and `NPM_RELEASE_BOT_TOKEN` are configured in GitLab CI/CD variables.
4. Check whether `NPM_RELEASE_BOT_TOKEN` is configured and has publish access to `@solvimon/solvimon-web`.
5. Check whether the same version already exists on npm. npm package versions are immutable.
6. Check the `publish:npm` job logs in the SDK pipeline.
7. Check whether the version bump command updated `packages/sdk/package.json` to the expected version before merge.
