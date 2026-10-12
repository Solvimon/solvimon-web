import { mount } from '@vue/test-utils';
import TaxIDCheckNotice from './TaxIDCheckNotice.vue';

describe('TaxIDCheckNotice', () => {
    it('confirms a valid VAT number', () => {
        const wrapper = mount(TaxIDCheckNotice, { props: { status: 'VALID' } });

        expect(wrapper.text()).toContain('VAT number is valid.');
    });

    it('rejects an invalid VAT number', () => {
        const wrapper = mount(TaxIDCheckNotice, { props: { status: 'NOT_VALID' } });

        expect(wrapper.text()).toContain('VAT number is invalid.');
    });

    it('does not call a VAT number invalid when it could not be checked', () => {
        const wrapper = mount(TaxIDCheckNotice, { props: { status: 'UNKNOWN' } });

        expect(wrapper.text()).toContain('The VAT number could not be checked right now.');
        expect(wrapper.text()).not.toContain('invalid');
        expect(wrapper.html()).not.toContain('danger');
    });
});
