Prepare a new SDK release by bumping the version and updating the changelog, then tell you what to commit and push manually.

## Steps

1. Read the current version from `package.json`.

2. Calculate what each bump type would produce:
   - `patch` → increment the last number (e.g. `0.1.0-alpha.7` → `0.1.0-alpha.8`)
   - `minor` → increment the middle number and reset patch (e.g. `0.1.0` → `0.2.0`)
   - `major` → increment the first number and reset the rest (e.g. `0.1.0` → `1.0.0`)

3. Inspect the commits since the last release tag and suggest a bump type:
   - Suggest `major` if any commit message indicates a breaking change (e.g. `BREAKING CHANGE`, `!` after the type, or removing public API).
   - Suggest `minor` if any commit adds a feature (`feat:`).
   - Otherwise suggest `patch`.

4. Ask the user which bump type to use, showing the resulting version for each option.

5. Run the appropriate version bump script (does not create a git tag):
   ```bash
   npm run version:patch   # or version:minor / version:major
   ```

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
    - Suggested commit message: `chore(release): release version <version>`
    - Files to stage: `package.json`, `package-lock.json`, `CHANGELOG.md`
    - Create a branch, commit, push, and open a pull request to `main`

## Notes

- Do not create a git tag locally — that is handled by the GitHub Actions workflow after the PR is merged.
- If the working tree has uncommitted changes unrelated to the release, warn the user before proceeding.
- If no commits exist since the last tag, tell the user and stop.
