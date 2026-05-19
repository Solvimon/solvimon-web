Fetch open Dependabot alerts for this repository and fix them.

## Steps

1. Fetch open alerts:
   ```bash
   gh api repos/Solvimon/solvimon-web/dependabot/alerts \
     --jq '[.[] | select(.state=="open")] | sort_by(.security_advisory.severity) | reverse'
   ```

2. Display a summary grouped by severity (critical → high → medium → low), showing for each alert:
   - Package name and vulnerable version range
   - CVE / GHSA identifier
   - One-line description of the vulnerability
   - The patched version (if available)

3. If there are no open alerts, report that and stop.

4. For each alert (highest severity first):
   - Check whether the package is a direct dependency in `package.json` or a transitive one.
   - **Direct dependency**: update it with `npm install <package>@<patched-version>` (or `@latest` if no specific version is listed).
   - **Transitive dependency**: try `npm audit fix`; if that does not resolve it, add an override in `package.json` under `overrides` to force the patched version.
   - Run `npm install` after any `package.json` change to update `package-lock.json`.

5. After all fixes are applied, run:
   ```bash
   npm audit
   ```
   and confirm the addressed alerts are gone. Report any that could not be fixed automatically (e.g. no patch available, or a breaking major bump required) and explain why.

6. Tell the user which packages were updated and suggest a commit message, e.g.:
   ```
   chore(deps): fix dependabot security alerts
   ```

## Notes

- Do not bump a package to a major version without flagging it to the user first — a major bump may contain breaking changes.
- If `npm audit fix --force` is the only option, explain what it would do and ask before running it.
- Never modify `package-lock.json` directly; always go through `npm install` or `npm audit fix`.
