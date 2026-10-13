import { describe, it, expect } from 'vitest';
import { checkFiles, findLabelsInFileName, findLabelsInSpec } from './check-test-labels.mjs';

const kindsIn = (content: string) =>
    findLabelsInSpec('a.spec.ts', content).map(({ kind, line }) => `${kind}@${line}`);

describe('findLabelsInFileName', () => {
    it.each([
        'src/a/PayInvoice.tester.spec.ts',
        'src/a/usePromotionCode.r2.spec.ts',
        'tests/playwright/e2e/dd-3538-tester.spec.ts',
        'tests/playwright/e2e/dd3540.spec.ts',
        'src/a/useItems.dd3540.spec.ts',
    ])('flags %s', (file) => {
        expect(findLabelsInFileName(file)).toHaveLength(1);
    });

    it.each([
        'src/a/useRouter.spec.ts',
        'src/a/requester.spec.ts',
        'src/a/usePaymentMethodOptions.races.spec.ts',
        'tests/playwright/e2e/redirect-return.spec.ts',
        'src/a/r2d2.spec.ts',
    ])('leaves %s alone', (file) => {
        expect(findLabelsInFileName(file)).toEqual([]);
    });
});

describe('findLabelsInSpec', () => {
    it('flags titles that name a ticket, a reviewer or a review round', () => {
        const content = [
            "describe('DD-3540 tester: promotion codes', () => {});",
            "it('pays once, tested independently', () => {});",
            "test.describe('round 2: the drop-in', () => {});",
            "it.each([1, 2])('Stripe frame, tried from outside (%i)', () => {});",
            'describe(`implementer checks for ${name}`, () => {});',
        ].join('\n');

        expect(kindsIn(content)).toEqual(['title@1', 'title@2', 'title@3', 'title@4', 'title@5']);
    });

    it('leaves titles that describe behaviour alone', () => {
        const content = [
            "describe('usePromotionCode against a superseding preview', () => {});",
            "it('rounds 2.5 up to the minor unit', () => {});",
            "it('closes on a click from outside the modal', () => {});",
            "test('pays in the round amount', () => {});",
            "expect(screen.getByText('DD-3540')).toBeTruthy();",
        ].join('\n');

        expect(kindsIn(content)).toEqual([]);
    });

    it('flags the lines of a comment that address the review', () => {
        const content = [
            '/**',
            ' * Holds the second payment.',
            ' * DD-3538 round 2, from the tester: the form is let go.',
            ' */',
            '// as the implementer wrote it',
            '// a refund rounds to 2 decimals',
        ].join('\n');

        expect(kindsIn(content)).toEqual(['comment@3', 'comment@5']);
    });

    it('reads a label inside a string as data, not as a comment', () => {
        expect(kindsIn("const url = 'https://example.com/tester?id=DD-1';")).toEqual([]);
    });
});

describe('checkFiles', () => {
    it('reports the file with each label found', () => {
        const files = {
            'src/a/Clean.spec.ts': "it('works', () => {});",
            'src/a/Form.tester.spec.ts': "describe('DD-1 tester', () => {});",
        };

        expect(
            checkFiles(Object.keys(files), (file) => files[file as keyof typeof files]).map(
                ({ file, kind }) => `${file} ${kind}`,
            ),
        ).toEqual(['src/a/Form.tester.spec.ts file name', 'src/a/Form.tester.spec.ts title']);
    });
});
