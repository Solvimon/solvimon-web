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
- `credentials: 'omit'` is the default in `createRequestService` and must stay that way, to prevent
  credential leakage in cross-origin requests. The only permitted exception is the identity token
  pair — `/oauth/token` and `/oauth/refresh-token` in `src/services/tokens.ts` — which authenticate
  on an `HttpOnly` refresh cookie and pass `credentials: 'include'`. Do not raise it anywhere else.

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
- **Formatting** — Prettier owns all formatting; ESLint's formatting rules are disabled via `skipFormatting`. Never hand-format to taste — run `npm run format`. CI fails on `npm run format:check` and on any ESLint warning (`lint:ci` runs with `--max-warnings 0`).

## Bundle size

Each public screen and component is its own build entry, and `@solvimon/solvimon-web/core` loads them with `import()` per registered id. A client that embeds only Checkout downloads Checkout's entry plus the shared chunks it imports. Keep that true:

- **Shared base chunk.** Everything imported by the providers, `src/utils/customElements.ts`, and other code every entry uses ends up in one chunk (`customElements-*.mjs`) that every entry loads. Adding to it costs every client; put entry-specific logic in the entry or the feature that uses it.
- **Heavy or optional dependencies.** Payment SDKs, their stylesheets, and anything only one provider or branch needs are loaded with `import()` at the point of use, never as a static import from a module an entry loads up front.
- **Registries.** Do not add maps or switches that statically import every screen, component, or variant; one entry would then pull in all of them. `src/public/core/registry.ce.ts` loads by id with `import()` for this reason.
- **Side effects.** The package declares `"sideEffects": false`. Modules must not register elements, mutate globals, or run setup on import, except in the `*.entry.ce.ts` files whose job that is.
- **Styles.** `.sdk/tailwind.css` is inlined once and adopted by every entry's shadow root, so every Tailwind class used anywhere grows it for all clients. Reuse existing classes and theme tokens over arbitrary values, and avoid `<style>` blocks unless Tailwind cannot express the rule.
- **New dependencies.** Check what a dependency adds to the entries that import it before adding it; a dependency used by one screen must not end up in the shared chunk.

When a change touches the shared chunk, an entry's imports, styles, or dependencies, run `npm run build` before and after and compare the size of the affected entries and of `customElements-*.mjs` in `dist/`. `npm run analyze` shows what each chunk contains.

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
