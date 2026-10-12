import { mount } from '@vue/test-utils';
import HiddenLabelInput from './HiddenLabelInput.vue';

describe('HiddenLabelInput', () => {
    it('names the input with its own label, and nothing more', () => {
        const wrapper = mount(HiddenLabelInput, {
            props: { label: 'Postcode', name: 'postal_code' },
        });

        const input = wrapper.find('input');
        const label = wrapper.find(`label[for="${input.attributes('id')}"]`);
        expect(label.text()).toBe('Postcode');
        expect(wrapper.findAll('label')).toHaveLength(1);
        expect(wrapper.text()).not.toContain('optional');
    });

    it('passes the field on to the input', async () => {
        const wrapper = mount(HiddenLabelInput, {
            props: { label: 'City', name: 'city', placeholder: 'City...', modelValue: 'Delft' },
        });

        const input = wrapper.find('input');
        expect(input.attributes('name')).toBe('city');
        expect(input.attributes('placeholder')).toBe('City...');
        expect(input.element.value).toBe('Delft');

        await input.setValue('Leiden');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Leiden']);
    });

    it('shows an error below the input', () => {
        const wrapper = mount(HiddenLabelInput, {
            props: { label: 'State', name: 'state', error: 'The value is required' },
        });

        expect(wrapper.text()).toContain('The value is required');
        expect(wrapper.html()).toContain('border-red-500');
    });

    it('shows nothing below the input without an error', () => {
        const wrapper = mount(HiddenLabelInput, {
            props: { label: 'State', name: 'state', error: [] },
        });

        expect(wrapper.find('p').exists()).toBe(false);
    });
});
