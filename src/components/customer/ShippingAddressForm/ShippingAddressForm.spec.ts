import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import ShippingAddressForm from './ShippingAddressForm.vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

const { fieldsModel } = vi.hoisted(() => ({
    fieldsModel: { current: undefined as CheckoutFormState | undefined },
}));

// The checkout's own fields, covered by its spec; here they only have to hold the state.
vi.mock('@/components/customer/CheckoutForm/CheckoutAddressFields.vue', () => ({
    default: defineComponent({
        name: 'CheckoutAddressFields',
        props: {
            modelValue: { type: Object, required: true },
            variant: String,
            withCountry: Boolean,
            errors: Object,
        },
        setup(props) {
            return () => {
                fieldsModel.current = props.modelValue as CheckoutFormState;
                return h('div', { class: 'checkout-address-fields-stub' });
            };
        },
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const person = {
    id: 'cust_1',
    type: 'INDIVIDUAL',
    email: 'ada@example.com',
    individual: {
        name: { first_name: 'Ada', last_name: 'Lovelace' },
        residential_address: { country: 'NL' },
    },
} as unknown as Customer;

const organization = {
    id: 'cust_2',
    type: 'ORGANIZATION',
    email: 'billing@acme.com',
    organization: { legal_name: 'Acme BV', registered_address: { country: 'NL' } },
} as unknown as Customer;

type FormInstance = { submit: () => Promise<unknown> };

const mountForm = async (customer: Customer = person) => {
    const wrapper = mount(ShippingAddressForm, { props: { customer } });
    await flushPromises();
    return wrapper;
};

const fillIn = (values: Partial<CheckoutFormState>) => {
    Object.assign(fieldsModel.current!, values);
};

describe('ShippingAddressForm', () => {
    it('starts on the customer: their country, and their name as the recipient', async () => {
        await mountForm();

        expect(fieldsModel.current).toMatchObject({
            shippingCountry: 'NL',
            shippingFirstName: 'Ada',
            shippingLastName: 'Lovelace',
        });
    });

    it('ships an organization under its legal name', async () => {
        await mountForm(organization);

        expect(fieldsModel.current).toMatchObject({
            type: 'ORGANIZATION',
            companyLegalName: 'Acme BV',
            shippingCountry: 'NL',
        });
    });

    it('hands back nothing while the address is incomplete', async () => {
        const wrapper = await mountForm();

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toBeUndefined();
    });

    it('rejects a phone number that cannot be one', async () => {
        const wrapper = await mountForm();
        fillIn({
            shippingAddressLine1: 'Damrak 1',
            shippingPostalCode: '1012 LG',
            shippingCity: 'Amsterdam',
            shippingPhoneNumber: '12',
        });

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toBeUndefined();
    });

    it('hands back the address to store for the customer once it is complete', async () => {
        const wrapper = await mountForm();
        fillIn({
            shippingAddressLine1: 'Damrak 1',
            shippingPostalCode: '1012 LG',
            shippingCity: 'Amsterdam',
            shippingPhoneNumber: '+31612345678',
        });

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toMatchObject({
            customer_id: 'cust_1',
            reference: expect.any(String),
            recipient: {
                type: 'INDIVIDUAL',
                individual: { name: { first_name: 'Ada', last_name: 'Lovelace' } },
                phone_number: '+31612345678',
                email: 'ada@example.com',
            },
            address: {
                line1: 'Damrak 1',
                postal_code: '1012 LG',
                city: 'Amsterdam',
                country: 'NL',
            },
        });
    });

    it('gives every address a reference of its own', async () => {
        const wrapper = await mountForm();
        fillIn({
            shippingAddressLine1: 'Damrak 1',
            shippingPostalCode: '1012 LG',
            shippingCity: 'Amsterdam',
            shippingPhoneNumber: '+31612345678',
        });
        const form = wrapper.vm as unknown as FormInstance;

        const first = (await form.submit()) as { reference: string };
        const second = (await form.submit()) as { reference: string };

        expect(first.reference).not.toBe(second.reference);
    });
});
