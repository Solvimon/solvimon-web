Prepare a new SDK release by bumping the version and updating the changelog, then tell you what to commit and push manually.

## Steps

1. Read the current version from `package.json`.

2. Calculate what each bump type would produce. On a version carrying a prerelease tag such as
   `-alpha`, `patch` and `minor` **strip that tag** rather than incrementing within it:
    - `prerelease` → increment the prerelease number (e.g. `0.1.0-alpha.25` → `0.1.0-alpha.26`)
    - `patch` → from `0.1.0-alpha.25` this gives `0.1.0`, and from `0.1.0` it gives `0.1.1`
    - `minor` → from `0.1.0-alpha.25` this gives `0.1.0`, and from `0.1.0` it gives `0.2.0`
    - `major` → increment the first number and reset the rest (e.g. `0.1.0` → `1.0.0`)

3. Inspect the commits since the last release tag and suggest a bump type:
    - **While the current version carries a prerelease tag, suggest `prerelease`** whatever the
      commits say. Anything else graduates the package out of alpha and publishes a stable version
      to the npm `latest` tag, which cannot be undone — npm versions are immutable. Leaving alpha
      is a deliberate decision for the user to state, not one to infer from a `feat:` commit.
    - Otherwise suggest `major` if any commit message indicates a breaking change (e.g.
      `BREAKING CHANGE`, `!` after the type, or removing public API).
    - Otherwise suggest `minor` if any commit adds a feature (`feat:`).
    - Otherwise suggest `patch`.

4. Ask the user which bump type to use, showing the resulting version for each option. Where a
   choice would leave the prerelease line, say so in the option itself.

5. Run the appropriate version bump script (does not create a git tag):

    ```bash
    npm run version:prerelease   # or version:patch / version:minor / version:major
    ```

    `npm run version:bump` prompts for the same choice and spells out what each does to a
    prerelease version.

6. Read the new version from `package.json`.

7. Gather the commits since the last release tag and group them into changelog categories:
    - **Added** — `feat:` commits and anything that introduces new behavior
    - **Changed** — `refactor:`, `perf:`, or commits that alter existing behavior
    - **Fixed** — `fix:` commits
    - Omit `chore:`, `ci:`, `docs:`, `test:` commits unless they are user-facing

    Draft human-readable bullet points — convert conventional commit messages into plain descriptions without ticket references or technical jargon.

8. Update `CHANGELOG.md`:
    - Replace the `## [Unreleased]` section with a new dated section: `## [<version>] - <today's date>`
    - Add a fresh empty `## [Unreleased]` section above it
    - Keep all previous sections intact

9. Run `npm run changelog:check` to verify the changelog is valid. Fix any issues before continuing.

10. Tell the user the release is ready and show the next manual steps:
    - Branch name: `release/<version>` (e.g. `release/0.1.0-alpha.16`)
    - Suggested commit message: `chore(release): release version <version>`
    - Files to stage: `package.json`, `package-lock.json`, `CHANGELOG.md`
    - Create the branch, commit, push, and open a pull request to `main`

## Notes

- Do not create a git tag locally — that is handled by the GitHub Actions workflow after the PR is merged.
- Merging a version bump to `main` publishes it. There is no separate approval step, so a wrong
  version reaches npm as soon as the pull request lands.
- If the working tree has uncommitted changes unrelated to the release, warn the user before proceeding.
- If no commits exist since the last tag, tell the user and stop.
