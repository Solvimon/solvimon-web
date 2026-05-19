[← Developer Documentation](readme.md)

# Dependabot Security Alerts

Dependabot monitors the project's dependencies and opens alerts when a known vulnerability is found. Alerts are visible in the GitHub repository under **Security → Dependabot alerts**.

## Prerequisites

The `/fix-dependabot` command uses the [GitHub CLI](https://cli.github.com/) to fetch alerts. Make sure it is installed and authenticated before running it.

```bash
# Install (macOS)
brew install gh

# Authenticate
gh auth login
```

Verify access to the repository:

```bash
gh repo view
```

## Fixing alerts with Claude Code

Run `/fix-dependabot` from Claude Code to fetch and fix all open alerts in one go:

1. Fetches every open alert via the GitHub API, grouped by severity (critical → high → medium → low).
2. Shows a summary: package, vulnerable version range, CVE/GHSA identifier, and the patched version.
3. For each alert, determines whether the package is a direct or transitive dependency and applies the appropriate fix:
   - **Direct dependency** — `npm install <package>@<patched-version>`
   - **Transitive dependency** — `npm audit fix`, or an `overrides` entry in `package.json` if that is not sufficient
4. Runs `npm audit` to confirm the alerts are resolved.
5. Reports any alerts it could not fix automatically (e.g. no patch available, or a breaking major-version bump required) and explains why.

## What the command will not do

- Bump a package to a new major version without flagging it to you first — a major bump may contain breaking changes.
- Run `npm audit fix --force` without asking — this can introduce breaking changes.
- Edit `package-lock.json` directly.

## Alerts in nested packages

This repository contains several nested packages with their own lock files:

| Path | Purpose |
|---|---|
| `package-lock.json` | Root SDK package |
| `examples/vue/package-lock.json` | Vue example app |
| `examples/next/package-lock.json` | Next.js example app |
| `tests/app/package-lock.json` | Test application |

Dependabot scans each lock file independently. When running `/fix-dependabot`, check the alert's **manifest path** in the summary — if the alert is in a nested package, `npm audit fix` must be run from that package's directory, not the root.

## Orphaned lock files

An orphaned lock file is a `package-lock.json` that has no corresponding `package.json` in the same directory. These can be left behind when a project is restructured and will trigger false-positive Dependabot alerts. The correct fix is to delete the orphaned file, not to update it — there is no package to install from.
