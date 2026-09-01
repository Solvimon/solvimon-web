# Environments

The SDK resolves API hostnames from the `environment` a host passes to `createSolvimonCore` or sets
as an attribute on a custom element. Those environments are split in two, and the split is enforced
by the build rather than by convention.

## What a customer gets

`TEST` and `LIVE` are the published surface. They are the only members of the public `Environment`
type, the only ones the README documents, and the only ones whose hostnames appear in the package on
npm.

`BETA` and `DEV` point at internal infrastructure — hostnames and ports that are of no use outside
Solvimon and should not be advertised. They exist for developing this package.

## How the split is enforced

Three things hold it, at three different layers.

**The type.** `Environment` is exported from `src/public/types/index.ts` as
`Extract<SolvimonEnvironment, 'TEST' | 'LIVE'>` — narrowed from the union in
`@solvimon/solvimon-types` rather than restated, so a rename upstream is a compile error here
instead of a surface that quietly drifts. `publicContract.spec.ts` asserts both halves, and
`tests/consumer-types/consumer.ts` asserts that a consumer naming `DEV` fails to compile.

**The bundle.** `src/config/lib.ts` reaches the internal configs through
`@/config/internalEnvironments`. In the published build, `resolve.alias` in `vite.config.ts`
redirects that specifier to `internalEnvironments.published.ts`, which exports an empty object. The
internal configs are therefore never in the module graph — nothing is trimmed out of the bundle,
because nothing was ever put in. That matters: a tree-shaking result has to be re-verified on every
build, whereas a module that was never imported cannot come back.

**The gate.** `npm run bundle:check-contents` reads the hostnames out of the internal config sources
and fails if any of them appears anywhere under `dist/`. It also fails if the _public_ hostnames are
missing, which is what an over-eager alias would look like. It runs in CI after the build, and in
`prepublishOnly`.

## Building with the internal environments

The flag is opt-in, so `npm run build` produces the publishable artifact by default. A variable
forgotten costs a developer their `DEV` environment locally; a variable forgotten the other way
round would ship internal hostnames to every customer.

```sh
npm run build           # publishable: TEST and LIVE only
npm run build:internal  # adds BETA and DEV, for the playground and the e2e test app
npm run watch           # the dev loop, which sets the same flag
```

The playground and `tests/app` both name `DEV` and both consume `dist/`, so they need a build that
includes it. Each casts through the public `Environment` type at the call site, with a comment
saying why.

`bundle:check-contents` refuses to run when `SOLVIMON_INTERNAL_ENVIRONMENTS=1` is set, rather than
reporting a failure it was told to cause.

## Adding an environment

Add the config module as `src/config/config.<name>.ts` and register it in
`src/config/internalEnvironments.ts`. The gate reads the hostnames straight out of the config
sources, so it covers the new environment without anyone remembering to extend it.

An environment that should be public instead goes in `publicEnvironments` in `src/config/lib.ts`,
gets added to `PublicEnvironment` in `src/config/types.ts`, and needs the README table updating.
That is a public API change: it can be added in a minor release, but never removed in one.
