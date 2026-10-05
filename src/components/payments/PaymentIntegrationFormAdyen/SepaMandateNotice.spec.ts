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

    it('runs the two sentences together in one paragraph', () => {
        const paragraphs = mountNotice('AIAIAI B.V.').findAll('p');

        // Title plus one body paragraph — the mandate reads as prose, not as a list.
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[1].text()).toContain('those instructions. This bank account');
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
