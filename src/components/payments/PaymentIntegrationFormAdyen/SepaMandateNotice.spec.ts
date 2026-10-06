import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SepaMandateNotice from './SepaMandateNotice.vue';

const mountNotice = (billingEntityName?: string) =>
    mount(SepaMandateNotice, { props: { billingEntityName } });

describe('SepaMandateNotice', () => {
    it('carries a title of its own', () => {
        expect(mountNotice('AIAIAI B.V.').text()).toContain(
            'SEPA Direct Debit mandate — recurring payments',
        );
    });

    it('names the billing entity in both sentences', () => {
        const text = mountNotice('AIAIAI B.V.').text();

        expect(text).toContain('you authorise AIAIAI B.V. to instruct your bank');
        expect(text).toContain('subsequent invoices from AIAIAI B.V. until you cancel');
    });

    it('runs the sentences together in one paragraph', () => {
        const paragraphs = mountNotice('AIAIAI B.V.').findAll('p');

        // Title plus one body paragraph — the mandate reads as prose, not as a list.
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[1].text()).toContain('those instructions. This bank account');
        expect(paragraphs[1].text()).toContain('this mandate. As part of your rights');
    });

    /**
     * The refund right is held against the payer's own bank, so it is stated whether or not the
     * creditor is known — the unnamed fallback must not quietly drop it.
     */
    it('states the refund rights, named or not', () => {
        for (const text of [mountNotice('AIAIAI B.V.').text(), mountNotice(undefined).text()]) {
            expect(text).toContain("you're entitled to a refund from your bank");
            expect(text).toContain('within 8 weeks from the date your account was debited');
            expect(text).toContain('request a statement from your bank explaining your rights');
        }
    });

    /**
     * A mandate reading "you authorise  to instruct your bank" would be worse than one that never
     * names the creditor, so the unnamed wording is written out rather than interpolated empty.
     */
    it('falls back to wording that does not need the name', () => {
        const text = mountNotice(undefined).text();

        expect(text).toContain('you authorise us to instruct your bank');
        expect(text).toContain('subsequent invoices until you cancel');
        expect(text).not.toContain('undefined');
        expect(text).not.toMatch(/authorise\s{2,}to/);
    });
});
