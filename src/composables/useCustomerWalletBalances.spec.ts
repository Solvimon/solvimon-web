import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { isTopUpButtonVisible } from './useCustomerWalletBalances';

const WALLET_TYPE_ID = 'wlt_type_credits';

const createSubscription = (
    configs: { on_demand?: boolean; walletTypeIds?: string[] }[],
): PricingPlanSubscriptionExpanded =>
    ({
        pricing_plan_schedule_infos: [
            {
                pricing_plan_version: {
                    pricing_categories: [
                        {
                            pricings: [
                                {
                                    items: [
                                        {
                                            configs: configs.map(
                                                ({ on_demand, walletTypeIds }) => ({
                                                    on_demand,
                                                    ...(walletTypeIds && {
                                                        wallet_grants: walletTypeIds.map(
                                                            (wallet_type_id) => ({
                                                                wallet_type_id,
                                                            }),
                                                        ),
                                                    }),
                                                }),
                                            ),
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('isTopUpButtonVisible', () => {
    it('is visible when a subscription charges an on-demand item for the wallet type', () => {
        const subscriptions = [
            createSubscription([{ on_demand: true, walletTypeIds: [WALLET_TYPE_ID] }]),
        ];

        expect(isTopUpButtonVisible({ subscriptions, walletTypeId: WALLET_TYPE_ID })).toBe(true);
    });

    it('is visible when any of the subscriptions charges for the wallet type', () => {
        const subscriptions = [
            createSubscription([{ on_demand: true, walletTypeIds: ['wlt_type_other'] }]),
            createSubscription([{ on_demand: false, walletTypeIds: [WALLET_TYPE_ID] }]),
            createSubscription([
                { on_demand: true, walletTypeIds: ['wlt_type_other', WALLET_TYPE_ID] },
            ]),
        ];

        expect(isTopUpButtonVisible({ subscriptions, walletTypeId: WALLET_TYPE_ID })).toBe(true);
    });

    it('is hidden when the item granting the wallet type is not charged on demand', () => {
        const subscriptions = [
            createSubscription([{ on_demand: false, walletTypeIds: [WALLET_TYPE_ID] }]),
        ];

        expect(isTopUpButtonVisible({ subscriptions, walletTypeId: WALLET_TYPE_ID })).toBe(false);
    });

    it('is hidden when the on-demand item grants a different wallet type', () => {
        const subscriptions = [
            createSubscription([{ on_demand: true, walletTypeIds: ['wlt_type_other'] }]),
        ];

        expect(isTopUpButtonVisible({ subscriptions, walletTypeId: WALLET_TYPE_ID })).toBe(false);
    });

    it('is hidden when the on-demand item grants nothing at all', () => {
        const subscriptions = [createSubscription([{ on_demand: true }])];

        expect(isTopUpButtonVisible({ subscriptions, walletTypeId: WALLET_TYPE_ID })).toBe(false);
    });

    it('is hidden when there are no subscriptions to check', () => {
        expect(isTopUpButtonVisible({ subscriptions: [], walletTypeId: WALLET_TYPE_ID })).toBe(
            false,
        );
    });
});
