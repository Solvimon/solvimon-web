import { mount } from '@vue/test-utils';
import BillingInformationForm from './BillingInformationForm.vue';

describe('BillingInformationForm', () => {
    it('names every address field for assistive technology', () => {
        const wrapper = mount(BillingInformationForm, {
            props: { isLoading: false, updateCustomer: vi.fn() },
            global: { stubs: { CountrySelect: true } },
        });

        for (const [name, label] of [
            ['address_line_2', 'Address line 2'],
            ['postal_code', 'Postal code'],
            ['city', 'City'],
            ['state', 'State'],
        ]) {
            const input = wrapper.find(`[data-testid="input-${name}"] input`);
            const labelElement = wrapper.find(`label[for="${input.attributes('id')}"]`);
            expect(labelElement.text()).toContain(label);
        }
    });
});
