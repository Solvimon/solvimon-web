import { createAutoTopUpConfigsService } from './autoTopUpConfigs';
import { createCustomerService } from './customer';
import { createInvoicesService } from './invoices';
import { createPaymentMethodsService } from './paymentMethods';
import { createPortalsService } from './portals';
import { createPricingPlanSchedulesService } from './pricingPlanSchedules';
import { createSubscriptionsService } from './subscriptions';
import { createWalletsService } from './wallets';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@solvimon/solvimon-ui', async () => ({
    ...(await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui')),
    downloadFile: vi.fn(),
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({
        apiUrls: { config: 'https://config.test/v1', transaction: 'https://transaction.test/v1' },
    }),
}));

/** Every service call that puts a host- or API-supplied id in its path. */
const calls: [
    name: string,
    call: (id: string) => Promise<unknown>,
    path: (id: string) => string,
][] = [
    [
        'getCustomer',
        (id) => createCustomerService().getCustomer(id),
        (id) => `/v1/portal/customers/${id}`,
    ],
    [
        'updateCustomer',
        (id) => createCustomerService().updateCustomer(id, {}),
        (id) => `/v1/portal/customers/${id}`,
    ],
    [
        'getInvoice',
        (id) => createInvoicesService().getInvoice(id),
        (id) => `/v1/portal/invoices/${id}`,
    ],
    [
        'getInvoicePdf',
        (id) => createInvoicesService().getInvoicePdf({ id, invoice_number: 'INV-1' }),
        (id) => `/v1/portal/invoices/${id}/pdf`,
    ],
    [
        'setDefaultPaymentMethod',
        (id) => createPaymentMethodsService().setDefaultPaymentMethod({ paymentMethodId: id }),
        (id) => `/v1/portal/payment-methods/${id}`,
    ],
    [
        'archivePaymentMethod',
        (id) => createPaymentMethodsService().archivePaymentMethod({ paymentMethodId: id }),
        (id) => `/v1/portal/payment-methods/${id}`,
    ],
    [
        'getAutoTopUpConfig',
        (id) => createAutoTopUpConfigsService().getAutoTopUpConfig(id),
        (id) => `/v1/portal/auto-top-up-configs/${id}`,
    ],
    [
        'deactivateAutoTopUpConfig',
        (id) => createAutoTopUpConfigsService().deactivateAutoTopUpConfig(id),
        (id) => `/v1/portal/auto-top-up-configs/${id}/deactivate`,
    ],
    [
        'getSubscription',
        (id) => createSubscriptionsService().getSubscription({ id }),
        (id) => `/v1/portal/pricing-plan-subscriptions/${id}`,
    ],
    [
        'setSubscriptionCancellation',
        (id) => createSubscriptionsService().setSubscriptionCancellation({ id, variant: 'CANCEL' }),
        (id) => `/v1/portal/pricing-plan-subscriptions/${id}/cancel`,
    ],
    [
        'getOnDemandPricingItems',
        (id) => createPricingPlanSchedulesService().getOnDemandPricingItems({ scheduleId: id }),
        (id) => `/v1/portal/pricing-plan-schedules/${id}/on-demand-pricing-items`,
    ],
    [
        'getPortalUrl',
        (id) => createPortalsService().getPortalUrl(id),
        (id) => `/v1/portal/portal-urls/${id}`,
    ],
    [
        'getCustomerWalletBalances',
        (id) => createWalletsService().getCustomerWalletBalances(id),
        (id) => `/v1/portal/customers/${id}/wallets/balance`,
    ],
];

const requestedUrl = () => new URL(mockRequest.mock.calls[0][0].url);

describe('ids in service paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue(new Blob());
    });

    describe.each(calls)('%s', (_, call, path) => {
        it('puts a plain id in the path as it is', async () => {
            await call('id_123');

            expect(requestedUrl().pathname).toBe(path('id_123'));
        });

        it.each([
            ['../../oauth/token', '..%2F..%2Foauth%2Ftoken'],
            ['%2e%2e%2f', '%252e%252e%252f'],
            ['x/../../customers', 'x%2F..%2F..%2Fcustomers'],
            ['x?expand[]=all', 'x%3Fexpand%5B%5D%3Dall'],
            ['x#frag', 'x%23frag'],
            ['<script>', '%3Cscript%3E'],
            ['ïd ✓', '%C3%AFd%20%E2%9C%93'],
        ])('keeps the hostile id %s to its own segment', async (id, encoded) => {
            await call(id);

            const url = requestedUrl();
            expect(url.pathname).toBe(path(encoded));
            expect(url.search).toBe('');
            expect(url.hash).toBe('');
        });

        it('keeps a very long id whole', async () => {
            const id = 'a'.repeat(5000);
            await call(id);

            expect(requestedUrl().pathname).toBe(path(id));
        });

        it.each(['', '.', '..'])('rejects the id %j without sending anything', async (id) => {
            await expect(call(id)).rejects.toThrow('Invalid URL path segment');
            expect(mockRequest).not.toHaveBeenCalled();
        });
    });
});
