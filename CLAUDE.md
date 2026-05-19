# Claude Code Guidelines

## Security

Apply these checks whenever writing or reviewing code in this repository.

### Path traversal (Node.js scripts)
Any file path derived from external input (arguments, config, environment) must be normalised and confirmed to sit inside the intended directory before use. See the existing guard in `scripts/check-translations.mjs` as the reference pattern:

```ts
const filePath = path.normalize(path.join(baseDir, untrustedSegment));
if (!filePath.startsWith(baseDir + path.sep)) {
    throw new Error(`Suspicious path: ${filePath}`);
}
```

### XSS
- Vue 3 templates escape output by default — keep it that way.
- Never use `v-html` with content that originates from user input or API responses.
- ICU translation strings may contain `<strong>` and similar tags rendered via `v-html`; only safe, hard-coded tags are acceptable there — never interpolate user data into those strings.

### Authentication & tokens
- The bearer token is injected by `createRequestService` — do not read or forward `accessToken` anywhere else.
- Never log tokens, credentials, or full authorization headers (not even to `console.error`).
- Token parsing (`parseToken` in `src/utils/token.ts`) must stay within a try/catch; never let a malformed token propagate uncaught.

### API requests
- Always use `createRequestService` for API calls — it handles auth headers and error propagation consistently.
- URL construction uses `new URL()` + `searchParams.append()` — never build URLs by string concatenation.
- `credentials: 'omit'` must remain on all `fetch` calls to prevent credential leakage in cross-origin requests.

### Input validation
- Use Vuelidate (`@vuelidate/core`) for all form validation. Do not roll custom validation logic for fields like email, VAT numbers, or amounts.
- Validate and sanitise query parameters read via `getQueryParam` before using them in any logic.

### Secrets
- Never hard-code API keys, tokens, or passwords.
- `.env` files must not be committed (already in `.gitignore`).

## Code style

- **TypeScript** — prefer explicit types on public function signatures; avoid `any`.
- **Composables** — side-effectful logic belongs in a composable, not directly in `<script setup>`. Name composables `use*`.
- **Services** — API calls belong in `src/services/`. Use `createRequestService` and return typed response interfaces.
- **Imports** — use the `@/` alias for internal imports; no relative paths that traverse more than one level (enforced by ESLint).
- **Lodash** — use named imports from `lodash-es`, never the default import.

## Testing

- Unit tests live next to the file they test (`foo.spec.ts` beside `foo.ts`).
- Use `@vue/test-utils` for component tests and Vitest for everything else.
- Do not mock the HTTP layer with fake data unless testing error paths — prefer testing the composable/service logic directly.

## Translations

- All user-visible strings must go through `$t()` with a string-literal ID and a `defaultMessage`.
- Run `/translate` after adding new strings to keep all locale files in sync.
- Never put user-supplied data inside a translation string that is rendered with `v-html`.
- See [docs/development/translations.md](docs/development/translations.md) for the full i18n workflow.

## Releasing

- Follow the steps in [docs/development/publish.md](docs/development/publish.md).
- Run `/create-release` to bump the version, draft the changelog, and validate before opening a PR.
