import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
    PaymentMethod,
    WalletAutoTopUpConfig,
    WalletAutoTopUpConfigPayload,
} from '@solvimon/solvimon-types';
import type { AutoTopUpRule } from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.types';
import type { TopUpPricingItem } from '@/components/wallets/TopUpModal/TopUpModal.lib';

/**
 * The rule the wallet runs on now, if any. Only an active one counts: turning a rule off leaves it
 * behind for the top-ups already charged under it, so an inactive config is history rather than
 * something to open the editor on.
 */
export const getActiveAutoTopUpConfig = (
    walletBalanceItem?: CustomerWalletBalanceItem,
): WalletAutoTopUpConfig | undefined =>
    (walletBalanceItem?.wallet?.auto_top_up_configs ?? []).find(
        ({ status }) => status === 'ACTIVE',
    );

export const toAutoTopUpRule = (
    config: WalletAutoTopUpConfig | undefined,
): AutoTopUpRule | undefined =>
    config
        ? {
              status: config.status,
              threshold: config.threshold,
              ...(config.topup_amount && { topup_amount: config.topup_amount }),
          }
        : undefined;

/**
 * Which top-up an automatic rule charges, as the pricing item and the schedule it is billed on.
 *
 * The wallet row hands one over when the customer asks from there. Falling back to the wallet's own
 * choose-your-amount top-up rather than any of them: a rule tops up by an amount of its own, which a
 * fixed pack cannot express.
 */
export const getAutoTopUpChargeTarget = (
    topUpItem: ChargeOnDemandPricingItem | undefined,
    topUpPricingItems: TopUpPricingItem[] = [],
): { pricingItemId: string; pricingPlanScheduleId: string } | undefined => {
    if (topUpItem?.pricing_item_id && topUpItem.pricing_plan_schedule_id) {
        return {
            pricingItemId: topUpItem.pricing_item_id,
            pricingPlanScheduleId: topUpItem.pricing_plan_schedule_id,
        };
    }

    const flexible = topUpPricingItems.find(
        ({ flexiblePricing, pricingPlanScheduleId }) => flexiblePricing && pricingPlanScheduleId,
    );

    return flexible?.pricingPlanScheduleId
        ? {
              pricingItemId: flexible.pricingItemId,
              pricingPlanScheduleId: flexible.pricingPlanScheduleId,
          }
        : undefined;
};

export const toCreateAutoTopUpConfigPayload = ({
    rule,
    walletBalanceItem,
    chargeTarget,
    paymentMethodId,
}: {
    rule: AutoTopUpRule | undefined;
    walletBalanceItem?: CustomerWalletBalanceItem;
    chargeTarget?: { pricingItemId: string; pricingPlanScheduleId: string };
    paymentMethodId?: PaymentMethod['id'];
}): WalletAutoTopUpConfigPayload | undefined => {
    const hasThreshold = !!(rule?.threshold?.amount ?? rule?.threshold?.credits);

    if (
        !rule ||
        !hasThreshold ||
        !walletBalanceItem?.wallet_id ||
        !chargeTarget ||
        !paymentMethodId
    ) {
        return undefined;
    }

    return {
        wallet_id: walletBalanceItem.wallet_id,
        status: rule.status,
        threshold: rule.threshold,
        pricing_plan_schedule_id: chargeTarget.pricingPlanScheduleId,
        pricing_item_id: chargeTarget.pricingItemId,
        payment_method_id: paymentMethodId,
        ...(rule.topup_amount && { topup_amount: rule.topup_amount }),
    };
};
