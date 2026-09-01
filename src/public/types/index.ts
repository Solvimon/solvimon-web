/**
 * Types the SDK declares itself rather than taking from a package it depends on.
 *
 * `@solvimon/solvimon-types` needs no entry here: the build vendors its declarations into the
 * published package, so every name in it resolves for a consumer who cannot install it.
 *
 * `@solvimon/solvimon-ui` cannot be vendored the same way — its declarations reach `@vuelidate/core`,
 * `vue-router`, `@tiptap/core` and five more packages this one does not depend on, so bringing them
 * along would trade one unresolvable import for eight. Only `IntlMessages` is on the surface a host
 * writes, and it is a single line, so it is declared here and checked against the original in
 * `publicContract.spec.ts`.
 */

/** Translation overrides, keyed by message id. */
export type IntlMessages = Record<string, string>;

/**
 * The environments the published package supports.
 *
 * Narrowed from the union in `@solvimon/solvimon-types` with `Extract` rather than restated, so a
 * rename upstream is a compile error here instead of a surface that quietly drifts. The remaining
 * environments are development infrastructure and are stripped from the published build; see
 * `src/config/internalEnvironments.ts`.
 */
export type { PublicEnvironment as Environment } from '@/config/types';
