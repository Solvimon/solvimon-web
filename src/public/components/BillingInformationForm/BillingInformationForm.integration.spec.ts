import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import BillingInformationFormEntry from './BillingInformationForm.entry.vue';
import type { SolvimonBillingInformationFormEntryProps } from './BillingInformationForm.entry.types';
import { ApiError } from '@/services/apiError';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import { providerMockLogger } from '@/test-utils/providerMock';

const { mockUseCustomer, mockGetExecute, mockUpdateExecute } = vi.hoisted(() => ({
    mockUseCustomer: vi.fn(),
    mockGetExecute: vi.fn(),
    mockUpdateExecute: vi.fn(),
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: mockUseCustomer,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', async () => {
    const { providerMockLogger } = await import('@/test-utils/providerMock');
    return { useLogger: () => providerMockLogger };
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        CountrySelect: defineComponent({
            name: 'CountrySelectStub',
            props: { singleModelValue: String, label: String },
            emits: ['update:singleModelValue'],
            template: '<select data-testid="country-select"></select>',
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div role="alert">{{ title }}</div>',
        }),
    });
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
        portalObject: createTestPortalObject(customerId),
    };

    const updateError = ref<Error | null>(null);

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
                error: updateError,
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
        updateError.value = null;
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

    it('logs a failed load of the customer as INITIAL_DATA_LOAD_FAILED', async () => {
        const failure = new Error('Request failed with status 500');
        mockGetExecute.mockRejectedValue(failure);

        mountComponent({ withCustomer: false });
        await flushPromises();

        expect(providerMockLogger.error).toHaveBeenCalledWith(
            'INITIAL_DATA_LOAD_FAILED',
            'Failed to load initial data',
            {},
            failure,
        );
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

    const getSaveButton = (wrapper: ReturnType<typeof mountComponent>) =>
        wrapper.find('button[type="submit"]');

    it('enables the save button once a field is edited', async () => {
        const wrapper = mountComponent();

        await wrapper.find('input[type="email"]').setValue('updated@example.com');

        expect(getSaveButton(wrapper).attributes('disabled')).toBeUndefined();
    });

    it('does not save an invalid email address and says why', async () => {
        const wrapper = mountComponent();

        await wrapper.find('input[type="email"]').setValue('foo');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(mockUpdateExecute).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('not a valid email');
    });

    it('shows an error the API gives on a field next to that field', async () => {
        const wrapper = mountComponent();

        updateError.value = new ApiError({
            statusCode: 400,
            field: 'email',
            message: 'Email address is already in use',
        });
        await flushPromises();

        expect(wrapper.text()).toContain('Email address is already in use');
    });

    it('shows an error the API gives on no field', async () => {
        const wrapper = mountComponent();

        updateError.value = new ApiError({ statusCode: 500, message: 'Something went wrong' });
        await flushPromises();

        expect(wrapper.text()).toContain('Something went wrong');
    });

    it('takes the saved customer as the new starting point', async () => {
        mockUpdateExecute.mockResolvedValue({ ...customer, email: 'normalised@example.com' });
        const wrapper = mountComponent();

        await wrapper.find('input[type="email"]').setValue('Normalised@Example.com');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe(
            'normalised@example.com',
        );
        expect(getSaveButton(wrapper).attributes('disabled')).toBeDefined();
    });

    it('keeps the form usable after a failed save', async () => {
        mockUpdateExecute.mockRejectedValueOnce(undefined);
        const wrapper = mountComponent();

        await wrapper.find('input[type="email"]').setValue('updated@example.com');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(getSaveButton(wrapper).attributes('disabled')).toBeUndefined();

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(mockUpdateExecute).toHaveBeenCalledTimes(2);
    });

    it('saves once when submitted twice in a row', async () => {
        const wrapper = mountComponent();

        await wrapper.find('input[type="email"]').setValue('updated@example.com');
        await wrapper.find('form').trigger('submit');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(mockUpdateExecute).toHaveBeenCalledOnce();
    });
});
