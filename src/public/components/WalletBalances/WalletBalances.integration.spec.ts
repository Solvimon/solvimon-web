import { mount } from '@vue/test-utils';
import { computed, defineComponent, h, ref } from 'vue';
import { ApiStatus } from '@solvimon/solvimon-types';
import type { CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import WalletBalancesEntry from './WalletBalances.entry.vue';
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockUseCustomerWalletBalances, mockUseLoadInitialData, mockFetch } = vi.hoisted(() => ({
    mockUseCustomerWalletBalances: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockFetch: vi.fn(),
}));

vi.mock('./WalletBalances.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-wallet-balances',
    SolvimonWalletBalances: {},
    defineSolvimonWalletBalances: () => {},
}));

vi.mock('@/composables/useCustomerWalletBalances', () => ({
    useCustomerWalletBalances: mockUseCustomerWalletBalances,
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: mockUseLoadInitialData,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup(props) {
                return () => h('div', { 'data-testid': 'error-notification-stub' }, props.title);
            },
        }),
        WalletBalances: defineComponent({
            name: 'WalletBalancesStub',
            props: { items: { type: Array, required: true }, title: String },
            setup(props) {
                return () => h('div', { 'data-testid': 'wallet-balances-stub' }, props.title);
            },
        }),
    });
});

describe('WalletBalances entry component', () => {
    const customerId = 'cus_123';

    const walletBalancesResponse = {
        wallet_balances: [
            {
                wallet_id: 'w_1',
                wallet_balance: {
                    open_balance: { currency: 'EUR', quantity: '100' },
                    balance_at: '2024-01-15T00:00:00Z',
                },
            },
        ],
        balance_at: '2024-01-15T00:00:00Z',
    } as unknown as CustomerWalletBalancesResponse;

    const defaultProps: SolvimonWalletBalancesEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        portalObject: createTestPortalObject(customerId),
    };

    const mountComponent = ({
        isLoading = false,
        apiStatus = ApiStatus.Done,
        walletBalancesData = walletBalancesResponse,
    }: {
        isLoading?: boolean;
        apiStatus?: ApiStatus;
        walletBalancesData?: CustomerWalletBalancesResponse | null;
    } = {}) => {
        mockUseCustomerWalletBalances.mockReturnValue({
            walletBalances: computed(() => walletBalancesData),
            apiStatus: ref(apiStatus),
            fetch: mockFetch,
            isPending: ref(false),
            error: ref(null),
        });

        mockUseLoadInitialData.mockReturnValue({
            isLoading: ref(isLoading),
        });

        return mount(WalletBalancesEntry, {
            props: defaultProps,
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue(walletBalancesResponse);
    });

    it('fetches wallet balances using the customer ID from the portal object', () => {
        mountComponent();

        expect(mockUseCustomerWalletBalances).toHaveBeenCalledWith({ customerId });
    });

    it('renders the skeleton when data is being loaded', () => {
        const wrapper = mountComponent({ isLoading: true });

        expect(wrapper.get('[data-testid="customer-wallet-balances-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
    });

    it('renders an error notification when loading fails', () => {
        const wrapper = mountComponent({ apiStatus: ApiStatus.Failed, walletBalancesData: null });

        expect(wrapper.get('[data-testid="error-notification-stub"]')).toBeTruthy();
        expect(wrapper.text()).toContain('Could not load wallet balances');
    });

    it('renders wallet balances when data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.get('[data-testid="wallet-balances-stub"]')).toBeTruthy();
    });

    it('renders nothing when there are no wallet balances', () => {
        const wrapper = mountComponent({ walletBalancesData: null });

        expect(wrapper.text()).toBe('');
    });
});
