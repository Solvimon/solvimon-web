import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import BillingInformationFormEntry from './BillingInformationForm.entry.vue';
import type { SolvimonBillingInformationFormEntryProps } from './BillingInformationForm.entry.types';

const { mockUseCustomer, mockGetExecute, mockUpdateExecute } = vi.hoisted(() => ({
    mockUseCustomer: vi.fn(),
    mockGetExecute: vi.fn(),
    mockUpdateExecute: vi.fn(),
}));

vi.mock('./BillingInformationForm.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-billing-information-form',
    SolvimonBillingInformationForm: {},
    defineSolvimonBillingInformationForm: () => {},
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: mockUseCustomer,
}));

vi.mock('@/components/providers', async () => ({
    Provider: defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    }),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        useIntl: () => ({
            $t: (message: { defaultMessage: string }) => message.defaultMessage,
        }),
        CountrySelect: defineComponent({
            name: 'CountrySelectStub',
            props: { singleModelValue: String, label: String },
            emits: ['update:singleModelValue'],
            template: '<select data-testid="country-select"></select>',
        }),
    };
});

describe('BillingInformationForm entry component', () => {
    const customerId = 'cus_123' as Customer['id'];

    const customer = {
        id: customerId,
        email: 'billing@example.com',
        type: 'INDIVIDUAL',
        individual: {
            name: { first_name: 'John', last_name: 'Doe' },
            residential_address: {
                line1: 'Main street 1',
                postal_code: '1000AA',
                city: 'Amsterdam',
                country: 'NL',
            },
        },
    } as unknown as Customer;

    const defaultProps: SolvimonBillingInformationFormEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        customElementName: 'solvimon-billing-information-form',
        portalObject: {
            object_type: 'PORTAL_URL',
            id: 'purl_example',
            type: 'CUSTOMER',
            customer_id: customerId,
            token: 'test-portal-token',
            status: 'PUBLISHED',
        } as unknown as SolvimonBillingInformationFormEntryProps['portalObject'],
    };

    const mountComponent = ({
        withCustomer = true,
        isPending = false,
    }: {
        withCustomer?: boolean;
        isPending?: boolean;
    } = {}) => {
        mockUseCustomer.mockReturnValue({
            customer: ref(withCustomer ? customer : undefined),
            get: {
                execute: mockGetExecute,
                isPending: ref(isPending),
            },
            update: {
                execute: mockUpdateExecute,
                isPending: ref(false),
                error: ref(null),
            },
        });

        return mount(BillingInformationFormEntry, {
            props: defaultProps,
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetExecute.mockResolvedValue(undefined);
        mockUpdateExecute.mockResolvedValue(customer);
    });

    it('requests the customer using the customer ID from the portalObject', () => {
        mountComponent();

        expect(mockUseCustomer).toHaveBeenCalledWith({ customerId });
    });

    it('fetches the customer data on mount', () => {
        mountComponent();

        expect(mockGetExecute).toHaveBeenCalledOnce();
    });

    it('does not render the form when customer data has not yet loaded', () => {
        const wrapper = mountComponent({ withCustomer: false });

        expect(wrapper.find('form').exists()).toBe(false);
    });

    it('renders the customer information form when customer data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('form').exists()).toBe(true);
        expect(wrapper.text()).toContain('Customer information');
        expect(wrapper.text()).toContain('Billing details');
        expect(wrapper.text()).toContain('Save changes');
    });

    it('pre-fills the email input with the customer email address', () => {
        const wrapper = mountComponent();

        const emailInput = wrapper.find('input[type="email"]');

        expect(emailInput.exists()).toBe(true);
        expect((emailInput.element as HTMLInputElement).value).toBe('billing@example.com');
    });

    it('renders the save button as disabled when there are no pending changes', () => {
        const wrapper = mountComponent();

        const saveButton = wrapper.find('button[type="submit"]');

        expect(saveButton.exists()).toBe(true);
        expect(saveButton.attributes('disabled')).toBeDefined();
    });

    it('calls update.execute when the form is submitted with changed data', async () => {
        const wrapper = mountComponent();

        const emailInput = wrapper.find('input[type="email"]');
        await emailInput.setValue('updated@example.com');

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(mockUpdateExecute).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'updated@example.com' }),
        );
    });
});
