import { resolveConfiguration } from './configuration';

describe('configuration utils', () => {
    describe('resolveConfiguration()', () => {
        it('returns the defaults when no configuration is given', () => {
            expect(resolveConfiguration({ showPayButton: true, showViewButton: true })).toEqual({
                showPayButton: true,
                showViewButton: true,
            });
        });

        it('keeps the options the configuration does not name at their default', () => {
            expect(
                resolveConfiguration(
                    { showPayButton: true, showViewButton: true },
                    { showPayButton: false },
                ),
            ).toEqual({ showPayButton: false, showViewButton: true });
        });

        it('treats an explicitly undefined option as absent', () => {
            expect(
                resolveConfiguration({ showPayButton: true }, { showPayButton: undefined }),
            ).toEqual({ showPayButton: true });
        });

        it('keeps a falsy option that is not undefined', () => {
            expect(resolveConfiguration({ maxItems: 3 }, { maxItems: 0 })).toEqual({ maxItems: 0 });
        });

        it('merges nested objects instead of replacing them', () => {
            expect(
                resolveConfiguration(
                    { pagination: { enabled: true, batchSize: 15 } },
                    { pagination: { batchSize: 20 } },
                ),
            ).toEqual({ pagination: { enabled: true, batchSize: 20 } });
        });

        it('takes an unknown option from the configuration', () => {
            expect(resolveConfiguration({ showPayButton: true }, { maxItems: 5 })).toEqual({
                showPayButton: true,
                maxItems: 5,
            });
        });

        it('replaces arrays and functions rather than merging them', () => {
            const onPaymentSuccess = () => undefined;

            expect(
                resolveConfiguration(
                    { enabledPricingIds: ['a', 'b'], onPaymentSuccess: undefined },
                    { enabledPricingIds: ['c'], onPaymentSuccess },
                ),
            ).toEqual({ enabledPricingIds: ['c'], onPaymentSuccess });
        });

        it('does not mutate the defaults', () => {
            const defaults = { pagination: { enabled: true, batchSize: 15 } };

            resolveConfiguration(defaults, { pagination: { batchSize: 20 } });

            expect(defaults).toEqual({ pagination: { enabled: true, batchSize: 15 } });
        });
    });
});
