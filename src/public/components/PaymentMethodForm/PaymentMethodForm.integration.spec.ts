import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PaymentMethodFormEntry from './PaymentMethodForm.entry.vue';
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';

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

vi.mock('./PaymentMethodForm.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-payment-method-form',
    SolvimonPaymentMethodForm: {},
    defineSolvimonPaymentMethodForm: () => {},
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
        customElementName: 'solvimon-payment-method-form',
        portalObject: {
            object_type: 'PORTAL_URL',
            id: 'purl_example',
            type: 'CUSTOMER',
            customer_id: customerId,
            token: 'test-portal-token',
            status: 'PUBLISHED',
        } as unknown as SolvimonPaymentMethodFormEntryProps['portalObject'],
    };

    const mountComponent = ({
        withCustomer = true,
        isLoading = false,
        paymentMethodOptions = [] as PaymentMethodOptionsResponse,
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
});
