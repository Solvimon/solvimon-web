import type {
    Amount,
    CustomerWalletBalanceItem,
    PricingItemConfigExtended,
    PricingItemExtended,
    PricingPlanSchedule,
    Pricing,
    PricingPlanSubscription,
    PricingPlanSubscriptionExpanded,
    WalletBalanceValue,
} from '@solvimon/solvimon-types';
import { hasOneOfPricingTypes, isFlexiblePricing } from '@solvimon/solvimon-ui';
import type { FlexiblePricingInputProps } from '@solvimon/solvimon-ui';

/**
 * What `charge_on_demand_pricing_items` actually contains: an entry naming the pricing item and the
 * schedule it is billed on, with the item — and the configs describing how it is priced — nested
 * under `pricing_item`.
 *
 * The types package declares the field as `PricingItemConfig[]`, so reading `details` or `configs`
 * straight off an entry type-checks but is undefined at runtime. Narrow until the type is corrected.
 */
interface ChargeOnDemandPricingItem {
    /** Sent back as `pricing_items[].pricing_item_id` when charging. */
    pricing_item_id?: PricingItemExtended['id'];
    /** The only place the top-up learns where to charge — the wallet balance does not say. */
    pricing_plan_schedule_id?: PricingPlanSchedule['id'];
    pricing_item?: {
        id?: PricingItemExtended['id'];
        configs?: PricingItemConfigExtended[];
    };
}

const isChargeOnDemandPricingItem = (entry: unknown): entry is ChargeOnDemandPricingItem =>
    typeof entry === 'object' && entry !== null && 'pricing_item' in entry;

export interface FlexibleTopUpPricing {
    /** Sent as `on_demand_pricing_items[].pricing_item_id` when charging the top-up. */
    pricingItemId: NonNullable<ChargeOnDemandPricingItem['pricing_item_id']>;
    /** The bounds the entered amount has to fall within. */
    config: FlexiblePricingInputProps['config'];
    /** Currency of the paid amount. */
    currency: string;
    /**
     * Present for credit based wallets, so the customer enters credits instead of an amount. The
     * entered value is still stored as the paid amount, converted with the grant's rate.
     */
    creditsConfiguration?: FlexiblePricingInputProps['creditsConfiguration'];
    /**
     * The same bounds expressed the way the customer reads them: in credits for a credit based
     * wallet, in money otherwise. Ready to hand to `formatWalletBalanceValue`.
     */
    bounds: { minimum?: WalletBalanceValue; maximum?: WalletBalanceValue };
}

export interface TopUpPricingItem {
    /** Sent as `pricing_items[].pricing_item_id` when charging the top-up. */
    pricingItemId: NonNullable<ChargeOnDemandPricingItem['pricing_item_id']>;
    /** The schedule this item is billed on, and so the one the top-up is charged on. */
    pricingPlanScheduleId?: PricingPlanSchedule['id'];
    /** How this item is priced — flexible, fixed, and so on. */
    config: PricingItemConfigExtended;
    /**
     * Present only for a choose-your-amount top-up: everything its input needs. Resolved here
     * because the bounds come from the config while the credits conversion comes from the wallet.
     */
    flexiblePricing?: Omit<FlexibleTopUpPricing, 'pricingItemId'>;
    /** Present only for a fixed-price top-up. */
    fixedPricing?: {
        /** What it costs. Always money — that is what actually gets charged. */
        amount: Amount;
        /**
         * The same top-up expressed the way the customer reads it: the credits it grants for a
         * credit based wallet, the money amount otherwise.
         */
        value: WalletBalanceValue;
    };
}

/**
 * The distinct schedules this wallet's top-ups are billed on. The balance names them and nothing
 * else, so they are the only handle on which subscriptions the wallet can be topped up for.
 */
export const getTopUpScheduleIds = (
    walletBalanceItem?: CustomerWalletBalanceItem,
): PricingPlanSchedule['id'][] => [
    ...new Set(
        (walletBalanceItem?.charge_on_demand_pricing_items ?? []).flatMap((entry) =>
            isChargeOnDemandPricingItem(entry) && entry.pricing_plan_schedule_id
                ? [entry.pricing_plan_schedule_id]
                : [],
        ),
    ),
];

export interface TopUpSubscription {
    id: PricingPlanSubscription['id'];
    /** What the customer knows it as, for the selector. */
    name: string;
    /** The schedules of this subscription that this wallet is topped up on. */
    scheduleIds: PricingPlanSchedule['id'][];
    /**
     * The pricings running on those schedules. Without these a summary has only the subscription's
     * name to show, since the plan description is routinely empty.
     */
    enabledPricingIds: Pricing['id'][];
}

/**
 * Which of the customer's subscriptions this wallet can be topped up for.
 *
 * A balance names the schedules its top-ups are billed on and nothing more, so the link to a
 * subscription is made through the schedules the subscriptions themselves carry. Order follows the
 * subscriptions given, so "the first" means the first the customer would see listed.
 */
export const getTopUpSubscriptions = (
    walletBalanceItem: CustomerWalletBalanceItem | undefined,
    subscriptions: PricingPlanSubscriptionExpanded[],
): TopUpSubscription[] => {
    const toppedUpOn = new Set(getTopUpScheduleIds(walletBalanceItem));

    return subscriptions.flatMap((subscription) => {
        const scheduleInfos = (subscription.pricing_plan_schedule_infos ?? []).filter(({ id }) =>
            toppedUpOn.has(id),
        );

        if (scheduleInfos.length === 0) {
            return [];
        }

        return [
            {
                id: subscription.id,
                name: subscription.name || subscription.reference || subscription.id,
                scheduleIds: scheduleInfos.map(({ id }) => id),
                enabledPricingIds: scheduleInfos.flatMap((info) =>
                    (info.pricing_plan_schedule?.enabled_pricings ?? []).flatMap(
                        ({ pricing_id }) => (pricing_id ? [pricing_id] : []),
                    ),
                ),
            },
        ];
    });
};

/**
 * The same wallet balance with only the top-ups billed on the given schedules left on it.
 *
 * The balances endpoint answers per customer, so a wallet shared across subscriptions offers the
 * on-demand items of all of them. A screen showing one subscription has to narrow that down, or it
 * offers top-ups that would be charged against a subscription the customer is not looking at.
 *
 * Returns the balance unchanged when no schedules are named, since then there is nothing to narrow
 * to — the customer overview passes none.
 */
export const withTopUpPricingItemsForSchedules = (
    walletBalanceItem: CustomerWalletBalanceItem | undefined,
    scheduleIds: PricingPlanSchedule['id'][],
): CustomerWalletBalanceItem | undefined => {
    if (!walletBalanceItem || scheduleIds.length === 0) {
        return walletBalanceItem;
    }

    const allowed = new Set(scheduleIds);

    return {
        ...walletBalanceItem,
        charge_on_demand_pricing_items: (
            walletBalanceItem.charge_on_demand_pricing_items ?? []
        ).filter(
            (entry) =>
                isChargeOnDemandPricingItem(entry) &&
                !!entry.pricing_plan_schedule_id &&
                allowed.has(entry.pricing_plan_schedule_id),
        ),
    };
};

/**
 * The ways this wallet can be topped up, one entry per pricing config, paired with the item id and
 * schedule needed to charge it.
 */
export const getTopUpPricingItems = (
    walletBalanceItem?: CustomerWalletBalanceItem,
): TopUpPricingItem[] =>
    (walletBalanceItem?.charge_on_demand_pricing_items ?? []).flatMap((entry) => {
        if (!isChargeOnDemandPricingItem(entry)) {
            return [];
        }

        // The entry names the item, and the nested item repeats its own id; either will do.
        const pricingItemId = entry.pricing_item_id ?? entry.pricing_item?.id;

        if (!pricingItemId) {
            return [];
        }

        return (entry.pricing_item?.configs ?? []).map((config) => {
            const flexiblePricing = getFlexiblePricing(config, walletBalanceItem);
            const fixedPricing = getFixedPricing(config, walletBalanceItem);

            return {
                pricingItemId,
                ...(entry.pricing_plan_schedule_id && {
                    pricingPlanScheduleId: entry.pricing_plan_schedule_id,
                }),
                config,
                ...(flexiblePricing && { flexiblePricing }),
                ...(fixedPricing && { fixedPricing }),
            };
        });
    });

/**
 * The single amount a fixed-price top-up costs, or undefined when the config is not a fixed
 * on-demand pricing — or names no amount, leaving nothing to charge.
 */
function getFixedPricing(
    config: PricingItemConfigExtended,
    walletBalanceItem?: CustomerWalletBalanceItem,
): NonNullable<TopUpPricingItem['fixedPricing']> | undefined {
    if (!config.on_demand || !hasOneOfPricingTypes(config, ['FIXED'])) {
        return undefined;
    }

    const amount = config.details?.bands?.[0]?.fixed_amount;

    if (!amount) {
        return undefined;
    }

    // A credit based wallet is topped up in credits, so that is what the customer is shown.
    const walletCredits = getWalletCredits(walletBalanceItem);
    const grantedCredits = walletCredits ? getGrantedCredits(config, walletBalanceItem) : undefined;

    return {
        amount,
        value:
            grantedCredits && walletCredits
                ? toCreditsValue(grantedCredits.quantity, walletCredits)
                : { amount },
    };
}

/**
 * A wallet is credit based when its balance is held in credits rather than money.
 */
const getWalletCredits = (walletBalanceItem?: CustomerWalletBalanceItem) =>
    walletBalanceItem?.wallet_balance.balance?.credits;

/**
 * The grants this config makes to the wallet in hand. Grants are configured per wallet type, so a
 * grant for another wallet is skipped — but the balances endpoint does not always tell us which
 * wallet type this balance is, and then the item's own grants are the only candidates.
 */
const getWalletGrants = (
    config: PricingItemConfigExtended,
    walletBalanceItem?: CustomerWalletBalanceItem,
) => {
    const walletTypeId = walletBalanceItem?.wallet_type_id;

    return (config.wallet_grants ?? []).filter(
        ({ wallet_type_id }) => !walletTypeId || wallet_type_id === walletTypeId,
    );
};

/** The rate the paid amount converts into credits at. */
const getCreditsConversion = (
    config: PricingItemConfigExtended,
    walletBalanceItem?: CustomerWalletBalanceItem,
) =>
    getWalletGrants(config, walletBalanceItem).find(
        ({ credits_grant }) => credits_grant?.conversion,
    )?.credits_grant?.conversion;

/** The credits a fixed top-up hands over outright, rather than converting from what is paid. */
const getGrantedCredits = (
    config: PricingItemConfigExtended,
    walletBalanceItem?: CustomerWalletBalanceItem,
) =>
    getWalletGrants(config, walletBalanceItem).find(({ credits_grant }) => credits_grant?.credits)
        ?.credits_grant?.credits;

/**
 * Expresses a quantity as credits of the wallet's own credit type, so it formats with that type's
 * unit names rather than a generic "credits".
 */
const toCreditsValue = (
    quantity: string,
    walletCredits: NonNullable<ReturnType<typeof getWalletCredits>>,
): WalletBalanceValue => ({ credits: { ...walletCredits, quantity } });

/** Multiplies a money quantity by a conversion rate. Undefined when either is not a number. */
const toCreditsQuantity = (quantity: string, rate: string): string | undefined => {
    const parsedQuantity = Number(quantity);
    const parsedRate = Number(rate);

    return Number.isFinite(parsedQuantity) && Number.isFinite(parsedRate)
        ? String(parsedQuantity * parsedRate)
        : undefined;
};

/**
 * What a choose-your-amount input needs for this config, or undefined when the config is not a
 * flexible on-demand pricing — or names no currency, leaving nothing enterable.
 */
function getFlexiblePricing(
    config: PricingItemConfigExtended,
    walletBalanceItem?: CustomerWalletBalanceItem,
): Omit<FlexibleTopUpPricing, 'pricingItemId'> | undefined {
    if (!config.on_demand || !isFlexiblePricing(config)) {
        return undefined;
    }

    const band = config.details?.bands?.[0];
    const currency =
        band?.minimum_amount?.currency ??
        band?.maximum_amount?.currency ??
        walletBalanceItem?.wallet_balance.balance?.amount?.currency;

    if (!currency) {
        return undefined;
    }

    // Whether credits can be entered follows the balance: only a credit based wallet converts.
    const credits = getWalletCredits(walletBalanceItem);
    const conversion = credits ? getCreditsConversion(config, walletBalanceItem) : undefined;
    const unitName = credits?.credit_type?.unit_name;

    /**
     * A bound as the customer reads it: converted to credits where the wallet holds credits, and
     * left as money otherwise — or when the rate does not parse, so a bound is never dropped.
     */
    const toBound = (amount?: Amount): WalletBalanceValue | undefined => {
        if (!amount) {
            return undefined;
        }

        const quantity =
            credits && conversion ? toCreditsQuantity(amount.quantity, conversion.rate) : undefined;

        return quantity !== undefined && credits ? toCreditsValue(quantity, credits) : { amount };
    };

    return {
        config: {
            ...(band?.minimum_amount && { minimum_amount: band.minimum_amount }),
            ...(band?.maximum_amount && { maximum_amount: band.maximum_amount }),
        },
        currency,
        ...(conversion && {
            creditsConfiguration: {
                conversionRate: conversion.rate,
                ...(unitName?.singular && { unitNameSingle: unitName.singular }),
                ...(unitName?.plural && { unitNamePlural: unitName.plural }),
            },
        }),
        bounds: {
            ...(toBound(band?.minimum_amount) && { minimum: toBound(band?.minimum_amount) }),
            ...(toBound(band?.maximum_amount) && { maximum: toBound(band?.maximum_amount) }),
        },
    };
}

/**
 * What a top-up adds to the wallet, expressed the way the customer reads their balance: the credits it
 * grants for a credit based wallet, the money amount otherwise.
 *
 * A choose-your-amount top-up takes its credit type from the bounds, which already carry it — the
 * pricing item on its own does not say what the balance is held in. Undefined when a flexible top-up
 * has no amount entered yet, since then it adds nothing.
 */
export const getTopUpValue = (
    item: TopUpPricingItem,
    amount?: Amount,
): WalletBalanceValue | undefined => {
    if (item.fixedPricing) {
        return item.fixedPricing.value;
    }

    if (!item.flexiblePricing || !amount) {
        return undefined;
    }

    const { bounds, creditsConfiguration } = item.flexiblePricing;
    const credits = (bounds.minimum ?? bounds.maximum)?.credits;
    const quantity = creditsConfiguration
        ? toCreditsQuantity(amount.quantity, creditsConfiguration.conversionRate)
        : undefined;

    return credits && quantity !== undefined ? toCreditsValue(quantity, credits) : { amount };
};

/**
 * Find what the customer can top this wallet up with: the flexible (choose-your-amount) on-demand
 * pricing item the balances endpoint returns alongside the wallet. Returns undefined when the
 * wallet has no such item, in which case there is nothing to enter.
 */
export const getFlexibleTopUpPricing = (
    walletBalanceItem?: CustomerWalletBalanceItem,
): FlexibleTopUpPricing | undefined => {
    for (const { pricingItemId, flexiblePricing } of getTopUpPricingItems(walletBalanceItem)) {
        if (flexiblePricing) {
            return { pricingItemId, ...flexiblePricing };
        }
    }

    return undefined;
};
