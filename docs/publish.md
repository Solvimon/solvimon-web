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
- The SDK bundle includes the internal `@solvimon/ui` and `@solvimon/types` packages, so consumers only need access to `@solvimon/sdk`.
- The publish job uses `CI_JOB_TOKEN` to authenticate against the GitLab package registry.
- The auto-tag job must have permission to push tags back to the repository. If that permission is missing, the tag creation step will fail.

## Troubleshooting

If the SDK does not publish after merging a version bump:

1. Check whether `packages/sdk/package.json` was actually changed in the merged commit.
2. Check whether the version already has a tag like `sdk-v<version>`.
3. Check whether the CI job was allowed to push tags to the repository.
4. Check the `publish:npm` job logs in the SDK pipeline.
5. Check whether the version bump command updated `packages/sdk/package.json` to the expected version before merge.
