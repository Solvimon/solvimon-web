import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import { ApiStatus } from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useSubscription } from './useSubscription';

const mockGetSubscription = vi.fn<
    (params: {
        id: PricingPlanSubscription['id'];
        expanded: true;
    }) => Promise<PricingPlanSubscriptionExpanded>
>();

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: vi.fn(() => ({
        getSubscription: mockGetSubscription,
    })),
}));

describe('useSubscription', () => {
    beforeEach(() => {
        mockGetSubscription.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetches the subscription for the given subscription id and updates state', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const response = {
            id: subscriptionId,
        } as PricingPlanSubscriptionExpanded;

        mockGetSubscription.mockResolvedValue(response);

        const { subscription, get, error, apiStatus, isPending } = useSubscription({
            subscriptionId,
        });

        expect(subscription.value).toBeUndefined();
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Initial);
        expect(isPending.value).toBe(false);

        const promise = get();

        expect(apiStatus.value).toBe(ApiStatus.Loading);
        expect(isPending.value).toBe(true);

        await expect(promise).resolves.toStrictEqual(response);

        expect(mockGetSubscription).toHaveBeenCalledTimes(1);
        expect(mockGetSubscription).toHaveBeenCalledWith({ id: subscriptionId, expanded: true });
        expect(subscription.value).toStrictEqual(response);
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Done);
        expect(isPending.value).toBe(false);
    });

    it('sets error state when the subscription service fails', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const serviceError = new Error('Network error');

        mockGetSubscription.mockRejectedValue(serviceError);

        const { subscription, get, error, apiStatus, isPending } = useSubscription({
            subscriptionId,
        });

        await expect(get()).rejects.toBeUndefined();

        expect(mockGetSubscription).toHaveBeenCalledWith({ id: subscriptionId, expanded: true });
        expect(subscription.value).toBeUndefined();
        expect(error.value).toStrictEqual(serviceError);
        expect(apiStatus.value).toBe(ApiStatus.Failed);
        expect(isPending.value).toBe(false);
    });
});
