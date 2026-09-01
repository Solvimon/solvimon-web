import { expectTypeOf } from 'vitest';
import type { IntlMessages as UiIntlMessages } from '@solvimon/solvimon-ui';
import type { Environment as SolvimonEnvironment } from '@solvimon/solvimon-types';
import type { Environment, IntlMessages } from './index';

/**
 * `IntlMessages` is declared in this package rather than taken from `@solvimon/solvimon-ui`, for the
 * reason given next to it. Nothing else keeps the copy in step with the original, so this does —
 * at compile time, under `type-check`, and without passing on a comparison against `any`:
 * `expectTypeOf` rejects that outright, so this fails loudly if `@solvimon/solvimon-ui` ever stops
 * resolving in CI.
 */
describe('public type contract', () => {
    it('keeps IntlMessages in step with the Solvimon UI package', () => {
        expectTypeOf<IntlMessages>().toEqualTypeOf<UiIntlMessages>();
    });

    /**
     * `Environment` is narrowed from the internal union rather than restated, so this fails if
     * either side moves: a public environment dropped upstream, or an internal one that starts
     * reaching the surface a host writes against.
     */
    it('publishes only the environments a customer can use', () => {
        expectTypeOf<Environment>().toEqualTypeOf<'TEST' | 'LIVE'>();
    });

    it('narrows the internal union rather than declaring a second one', () => {
        expectTypeOf<Environment>().toExtend<SolvimonEnvironment>();
    });
});
