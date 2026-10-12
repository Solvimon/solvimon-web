import { toRestorableForm } from './savedFormState';

/** DD-3540 tester, round 2: what a restored form makes of hostile and odd storage. */
describe('DD-3540 tester: toRestorableForm on hostile input', () => {
    it('takes nothing from prototype keys and pollutes no prototype', () => {
        const saved: unknown = JSON.parse(
            '{"__proto__":{"email":"evil@example.com","polluted":true},' +
                '"constructor":{"prototype":{"polluted":true}},"firstName":"Ada"}',
        );

        const form = toRestorableForm(saved);

        expect(form).toEqual({ firstName: 'Ada' });
        expect(Object.getPrototypeOf(form)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('handles a very long list quickly', () => {
        const seatsValues = Array.from({ length: 200_000 }, (_, index) => ({
            pricing_item_config_id: `pic_${index}`,
            number: '1',
        }));
        const started = performance.now();
        const form = toRestorableForm({ seatsValues });
        expect(performance.now() - started).toBeLessThan(1000);
        // Not capped: whatever fits in storage is restored and later priced.
        expect(form.seatsValues).toHaveLength(200_000);
    });

    // Expected failure (low): the seat is kept without a number, or with one that is not a count,
    // and replaces the plan's default. In the checkout the preview is then priced on
    // `{ pricing_item_config_id }` alone, or on `number: 'abc'`, while the editor shows 1 or nothing.
    it.fails.each([
        ['a number given as a number', 5],
        ['a number that is not numeric', 'abc'],
        ['a negative number', '-3'],
    ])('drops seats with %s', (_, number) => {
        const form = toRestorableForm({
            seatsValues: [{ pricing_item_config_id: 'pic_1', number }],
        });
        expect(form.seatsValues).toBeUndefined();
    });

    it('keeps an email with unicode only if the form would accept it', () => {
        const form = toRestorableForm({ email: 'jürgen@bücher.de' });
        expect(form.email === undefined || form.email === 'jürgen@bücher.de').toBe(true);
    });

    it('drops a country in lowercase', () => {
        expect(toRestorableForm({ country: 'nl' })).toEqual({});
    });
});
