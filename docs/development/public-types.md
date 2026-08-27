# Public Types

The SDK is published to the public npm registry. `@solvimon/solvimon-types` and
`@solvimon/solvimon-ui` are not — they live in the private GitLab registry. A type imported from
either of them cannot be resolved by anyone outside Solvimon, and because consumers build with
`skipLibCheck: true` it does not fail their build: it silently becomes `any`.

That is not a theoretical problem. It is how DD-3333 shipped a `configuration` prop where a
misspelled option was neither a type error nor a runtime warning — it just turned the feature off.

## How each package is handled

**`@solvimon/solvimon-types` is vendored.** The build emits its declarations into
`dist/types/vendor/`, then rewrites every import of it in the published tree to point at that copy.
Nothing is duplicated in this repository and nothing can drift: the vendored declarations are
generated from the installed package on every build. The SDK's own code keeps importing it by name,
exactly as before — the rewriting happens after the declarations are emitted.

Its declarations are emitted rather than its files copied. The package ships `.ts` with no `types`
field, and `skipLibCheck` does not cover `.ts`, so shipping the source would hand every consumer's
compiler a few thousand lines to type-check under settings we do not control.

**`@solvimon/solvimon-ui` is not.** Its declarations reach `@vuelidate/core`, `vue-router`, `clsx`,
`@vue/test-utils`, `@tiptap/core`, `@formatjs/intl`, `@floating-ui/vue` and `@floating-ui/utils` —
none of them dependencies of this package — so vendoring it would trade one unresolvable import for
eight. Only `IntlMessages` is on the surface a host writes, and it is one line, so
[`src/public/types/`](../../src/public/types/) declares it and
[`publicContract.spec.ts`](../../src/public/types/publicContract.spec.ts) checks it against the
original. The two other names it contributes reach consumers only through internal provider props
that nobody writes, so they are allowlisted rather than mirrored.

## Adding to the public surface

Nothing special is needed for a type from `@solvimon/solvimon-types` — import it by name and the
build vendors it. Reach for `src/public/types/` only when a type has to come from somewhere that
cannot be vendored, and add an assertion next to it when you do.

## The three checks

Nothing here is upheld by convention alone.

| Check                           | Runs            | Catches                                                            |
| ------------------------------- | --------------- | ------------------------------------------------------------------ |
| `npm run type-check`            | CI, every PR    | A declared type drifting from the one it copies                    |
| `npm run types:check-published` | CI, after build | A published declaration naming something a consumer cannot resolve |
| `npm run types:check-consumer`  | CI, after build | Anything a consumer would actually hit, packaging included         |

**`type-check`** covers `publicContract.spec.ts`, whose assertions are compile-time only.
`expectTypeOf` rejects a comparison against `any`, so if the private packages ever fail to resolve
in CI the assertions fail loudly rather than comparing `any` to `any` and passing.

**`types:check-published`** walks the declarations reachable from every published entry point and
fails on any package that is neither a dependency nor a peer dependency of this one, unless the
type is on the allowlist in
[`check-published-types.mjs`](../../scripts/ci/check-published-types.mjs). The rule comes from
`package.json`, so a package added to `dependencies` needs no change here.

**`types:check-consumer`** packs the tarball, installs it into a tree outside the repository where
neither private package exists, and type-checks
[`tests/consumer-types/consumer.ts`](../../tests/consumer-types/consumer.ts) against it. The
fixture marks every line that has to fail with `@ts-expect-error`, so a clean compile is the whole
assertion: TypeScript reports an unused directive when a mistake that used to be caught no longer
is.

The fixture lives outside the repo on purpose. Node resolves from a file's real path, so a fixture
inside the repository walks up into the repository's own `node_modules`, finds the private packages,
and proves nothing.

## When a check fails

`types:check-published` names the type and the package. Either vendor that package the way
`vite.config.ts` does for `@solvimon/solvimon-types`, declare the type in `src/public/types/`, or —
if nothing a host writes goes through it — add it to the allowlist.

`types:check-consumer` failing with `Unused '@ts-expect-error' directive` means a mistake that used
to be caught no longer is. That almost always means a declaration stopped resolving and became
`any`. Run `npm run build && npm run types:check-consumer` locally to reproduce it.
