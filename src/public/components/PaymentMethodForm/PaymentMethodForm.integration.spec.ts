import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PaymentMethodFormEntry from './PaymentMethodForm.entry.vue';
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import {
    createPaymentMethodOptionEntry,
    createPaymentMethodOptionsResponseWithoutOptions,
} from '@/test-utils/paymentMethodOptionsFixture';

const {
    mockUseCustomer,
    mockUsePaymentMethodOptions,
    mockUseLoadInitialData,
    mockGetExecute,
    mockPaymentMethodOptionsGet,
} = vi.hoisted(() => ({
    mockUseCustomer: vi.fn(),
    mockUsePaymentMethodOptions: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockGetExecute: vi.fn(),
    mockPaymentMethodOptionsGet: vi.fn(),
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: mockUseCustomer,
}));

vi.mock('@/composables/usePaymentMethodOptions', () => ({
    usePaymentMethodOptions: mockUsePaymentMethodOptions,
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: mockUseLoadInitialData,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

describe('PaymentMethodForm entry component', () => {
    const customerId = 'cus_123' as Customer['id'];

    const customer = {
        id: customerId,
        type: 'INDIVIDUAL',
        individual: {
            name: { first_name: 'John', last_name: 'Doe' },
            residential_address: { country: 'NL' },
        },
    } as unknown as Customer;

    const defaultProps: SolvimonPaymentMethodFormEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        portalObject: createTestPortalObject(customerId),
    };

    const mountComponent = ({
        withCustomer = true,
        isLoading = false,
        paymentMethodOptions = [createPaymentMethodOptionEntry()] as PaymentMethodOptionsResponse,
    }: {
        withCustomer?: boolean;
        isLoading?: boolean;
        paymentMethodOptions?: PaymentMethodOptionsResponse;
    } = {}) => {
        mockUseCustomer.mockReturnValue({
            customer: ref(withCustomer ? customer : undefined),
            get: {
                execute: mockGetExecute,
                isPending: ref(false),
            },
        });

        mockUsePaymentMethodOptions.mockReturnValue({
            paymentMethodOptions: ref(paymentMethodOptions),
            get: mockPaymentMethodOptionsGet,
            isPending: ref(false),
        });

        mockUseLoadInitialData.mockReturnValue({
            isLoading: ref(isLoading),
        });

        return mount(PaymentMethodFormEntry, {
            props: defaultProps,
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetExecute.mockResolvedValue(customer);
        mockPaymentMethodOptionsGet.mockResolvedValue(undefined);
    });

    it('requests the customer using the customer ID from the portal object', () => {
        mountComponent();

        expect(mockUseCustomer).toHaveBeenCalledWith({ customerId });
    });

    it('does not render when customer data has not yet loaded', () => {
        const wrapper = mountComponent({ withCustomer: false });

        expect(wrapper.text()).toBe('');
    });

    it('renders the skeleton when data is being loaded', () => {
        const wrapper = mountComponent({ isLoading: true });

        expect(wrapper.get('[data-testid="payment-method-form-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
    });

    it('renders the available payment methods section when data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Available payment methods');
    });

    describe('when nothing offered would render', () => {
        it('says so rather than showing a section with an empty form in it', () => {
            const wrapper = mountComponent({
                paymentMethodOptions: createPaymentMethodOptionsResponseWithoutOptions(),
            });

            expect(wrapper.find('[data-testid="payment-methods-unavailable"]').exists()).toBe(true);
            expect(wrapper.text()).toContain('No payment methods can be added');
            expect(wrapper.text()).not.toContain('Available payment methods');
        });

        it('offers no retry, since nothing the customer does from here changes it', () => {
            const wrapper = mountComponent({
                paymentMethodOptions: createPaymentMethodOptionsResponseWithoutOptions(),
            });

            expect(wrapper.text()).not.toContain('Try again');
            expect(wrapper.find('button').exists()).toBe(false);
        });

        it('holds the loading state while the options are still out, rather than judging early', () => {
            const wrapper = mountComponent({ isLoading: true, paymentMethodOptions: [] });

            expect(wrapper.find('[data-testid="payment-methods-unavailable"]').exists()).toBe(
                false,
            );
            expect(wrapper.get('[data-testid="payment-method-form-skeleton"]')).toBeTruthy();
        });
    });
});
