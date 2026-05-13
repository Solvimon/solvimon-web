# Contributing

## Getting started

Follow the [setup guide](docs/development/setup.md) to configure your local environment and private package registry access, then install dependencies:

```sh
npm install
```

Run the playground to iterate on components in real time:

```sh
npm run playground:dev
```

## Development workflow

Work on a feature branch off `main`. Link every PR to the issue it addresses. Before opening a PR, make sure the following pass locally:

```sh
npm run type-check   # TypeScript + Vue template types
npm run lint         # ESLint (auto-fixes on save)
npm run test:unit    # Vitest unit tests
npm run build        # Full SDK build
```

CI runs all of these automatically on every PR, along with coverage and bundle size comparisons posted as PR comments. All checks must be green before merge.

## PR scope

Keep PRs small and focused — one logical change per PR. Do not mix the following in a single PR:

- Behavior changes
- Refactors or code cleanup
- Formatting or style fixes
- Dependency upgrades

Mixing concerns makes PRs harder to review and harder to revert safely. If you find cleanup worth doing, open a separate PR.

## PR description

Fill in the PR template completely. A good PR description includes:

- **What changed** — a brief summary of the change
- **Why** — the motivation or linked issue
- **Screenshots or examples** — for any visual or API change
- **Breaking changes** — if behavior or the public API changes in a non-backwards-compatible way
- **Migration notes** — what consumers need to do to adopt the change
- **Test evidence** — what was tested and how; CI results alone are not sufficient for non-trivial changes

## Review rules

- At least one approval is required before merge
- Do not merge your own PR for meaningful changes
- Public API changes require explicit maintainer approval
- Sensitive areas (release workflows, CI configuration, auth-related code) follow CODEOWNERS and require approval from the designated owners
- Branch protection is enforced via GitHub rulesets; do not bypass required status checks

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message must follow the format:

```
<type>(<scope>): <description>
```

Common types:

| Type | When to use |
|------|-------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, or dependency changes |

The scope is optional but encouraged — use the component or area being changed (e.g. `feat(checkout)`, `fix(invoice)`).

Commit messages are used to generate the changelog entries in `CHANGELOG.md`. A clear, descriptive commit message makes it straightforward to write accurate release notes and helps reviewers understand what changed and why.

## Code conventions

**TypeScript** — strict mode is enabled. Avoid `any`; use `unknown` and narrow where needed.

**Imports** — use the `@/` path alias for all imports from `src/`. Relative imports are not allowed outside of test files.

**Vue components** — PascalCase filenames and component names. Custom elements follow the `solvimon-*` naming convention.

**No console statements** — except inside the playground and test app.

**Tests** — co-locate unit tests with the source file they cover (`Component.spec.ts` next to `Component.vue`). Tests for CI scripts live in `scripts/ci/`.

**Comments** — only when the *why* is non-obvious. Do not describe what the code does.

## Testing

Run unit tests in watch mode during development:

```sh
npm run test:unit
```

Run with coverage:

```sh
npm run test:coverage
```

Run end-to-end tests:

```sh
npm run test:e2e
```

## Public API and package hygiene

Any change that affects what consumers see when they install `@solvimon/solvimon-web` requires extra care:

- **Semver** — classify the change as `patch`, `minor`, or `major` and note it in the PR description and changelog entry. Public API removals or breaking behavior changes are `major`.
- **Changelog** — every published version requires a matching entry in `CHANGELOG.md`. The release pipeline enforces this; the tag will not be created without it.
- **Package exports** — if you add or remove an entry point, update the `exports` field in `package.json` and verify the build output matches.
- **Generated files** — do not hand-edit files under `dist/`. They are produced by `npm run build` and must not be committed.
- **Examples and docs** — update the README or relevant docs when public-facing behavior changes.

## Security hygiene

- **No secrets** — never commit tokens, credentials, API keys, private URLs, or debug logs. The `.env` file is gitignored for this reason.
- **Dependencies** — before adding a new dependency, justify why it is needed. Prefer actively maintained packages with a healthy release cadence. Check download counts, last publish date, and open issues before adding. Avoid packages that pull in large transitive dependency trees without good reason.
- **Dependency updates** — Dependabot monitors this repository. Review and merge security updates promptly. `npm audit` should report zero high or critical vulnerabilities on `main`.
- **CI scripts** — treat CI configuration and scripts as security-sensitive. Changes to `.github/workflows/` and `scripts/ci/` require careful review; a compromised workflow can exfiltrate secrets or publish malicious releases.

## Releasing

See the [publishing guide](docs/development/publish.md) for the full release flow. The short version:

1. Bump the version with `npm run version:bump`.
2. Add a changelog entry for the new version.
3. Open a PR to `main` and merge after approval.
4. GitHub Actions creates the release tag and publishes to npm automatically.

**Publishing protection** — npm publishing uses a scoped `NPM_TOKEN` stored as a GitHub secret. Prefer migrating to npm Trusted Publishing (OIDC) when available to eliminate the need for long-lived tokens. npm 2FA is required on all accounts with publish access to `@solvimon`.
