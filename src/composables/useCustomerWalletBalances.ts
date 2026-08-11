import type {
    Customer,
    CustomerWalletBalancesResponse,
    PricingPlanSubscriptionExpanded,
    WalletType,
} from '@solvimon/solvimon-types';
import { computed } from 'vue';
import { createWalletsService } from '@/services/wallets';
import { useService } from '@/composables/useService';
import { getAllPricingsFromScheduleInfos } from '@/utils/pricing';

/**
 * A wallet can only be topped up when there is something to charge for it: an on-demand pricing
 * item that grants credit to this wallet type. Without any subscriptions to check, the button
 * stays hidden.
 */
export const isTopUpButtonVisible = ({
    subscriptions,
    walletTypeId,
}: {
    subscriptions: PricingPlanSubscriptionExpanded[];
    walletTypeId: WalletType['id'];
}): boolean =>
    getAllPricingsFromScheduleInfos(
        subscriptions.flatMap(({ pricing_plan_schedule_infos }) => pricing_plan_schedule_infos),
    )
        .flatMap((pricing) => pricing.items ?? [])
        .some((item) =>
            item.configs?.some(
                (config) =>
                    config.on_demand &&
                    config.wallet_grants?.some((grant) => grant.wallet_type_id === walletTypeId),
            ),
        );

export function useCustomerWalletBalances({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomerWalletBalances } = createWalletsService();

    const { data, execute, apiStatus, error, isPending } = useService({
        service: () => getCustomerWalletBalances(customerId),
    });

    const walletBalances = computed<CustomerWalletBalancesResponse | null>(
        () => data.value ?? null,
    );

    return { walletBalances, apiStatus, error, fetch: execute, isPending };
}
