# Publishing The SDK

The SDK is published as `@solvimon/sdk` to the private GitLab npm registry.

Publishing is automated through GitLab CI. You do not need to create and push the SDK tag manually.

## How Publishing Works

The SDK has its own release flow, separate from the rest of the monorepo.

1. Bump the version in `packages/sdk/package.json`.
2. Merge that change to `main`.
3. The SDK pipeline detects the version change and creates a tag in the format `sdk-v<version>`.
4. The tag pipeline publishes `@solvimon/sdk` to the private GitLab npm registry.

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
    - the package was published to the GitLab npm registry

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

- The SDK package is published to a private registry, but `packages/sdk/package.json` must remain publishable. That means it must not use `"private": true`.
- The SDK bundle includes the internal `@solvimon/solvimon-ui` and `/solvimon-types` packages, so consumers only need access to `@solvimon/sdk`.
- The publish job uses `CI_JOB_TOKEN` to authenticate against the GitLab package registry.
- The auto-tag job uses dedicated CI variables to push tags back to the repository.
- Local `npm publish` is blocked by a guard script. Publishing is only allowed from GitLab CI.

## Required CI Variables

The SDK auto-tag job does not use `CI_JOB_TOKEN` for Git pushes. Instead, configure these protected CI/CD variables in GitLab:

- `RELEASE_BOT_USERNAME`
- `RELEASE_BOT_TOKEN`

Recommended setup:

1. Create a project access token or bot token with permission to push tags to the repository.
2. Give it at least repository write access.
3. Add the token username as `RELEASE_BOT_USERNAME`.
4. Add the token secret as `RELEASE_BOT_TOKEN`.
5. Mark both variables as masked and protected.

The publish job can continue using `CI_JOB_TOKEN` for the npm registry publish itself.

## Consuming The SDK

Consumers can install the SDK from the private GitLab npm registry by configuring npm for the `@solvimon` scope and authenticating with a token that has package read access.

### Project Endpoint

Add this to the consumer project's `.npmrc`:

```ini
@solvimon:registry=https://gitlab.com/api/v4/projects/38958827/packages/npm/
//gitlab.com/api/v4/projects/38958827/packages/npm/:_authToken=${NPM_TOKEN}
always-auth=true
```

Then install the SDK:

```bash
npm install @solvimon/sdk
```

### Group Endpoint

If you prefer consuming packages through a group-level endpoint, use:

```ini
@solvimon:registry=https://gitlab.com/api/v4/groups/<GROUP_ID>/-/packages/npm/
//gitlab.com/api/v4/groups/<GROUP_ID>/-/packages/npm/:_authToken=${NPM_TOKEN}
always-auth=true
```

Then install:

```bash
npm install @solvimon/sdk
```

### Notes For Consumers

- Consumers need a token with package read access.
- The SDK now bundles the internal `@solvimon/solvimon-ui` and `/solvimon-types` packages, so consumers only need `@solvimon/sdk`.
- Do not commit registry tokens to `.npmrc`. Use environment variables such as `NPM_TOKEN`.

## Troubleshooting

If the SDK does not publish after merging a version bump:

1. Check whether `packages/sdk/package.json` was actually changed in the merged commit.
2. Check whether the version already has a tag like `sdk-v<version>`.
3. Check whether `RELEASE_BOT_USERNAME` and `RELEASE_BOT_TOKEN` are configured in GitLab CI/CD variables.
4. Check the `publish:npm` job logs in the SDK pipeline.
5. Check whether the version bump command updated `packages/sdk/package.json` to the expected version before merge.
