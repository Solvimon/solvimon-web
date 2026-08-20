import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
} from '@solvimon/solvimon-types';
import {
    getActiveAutoTopUpConfig,
    getAutoTopUpChargeTarget,
    toAutoTopUpRule,
    toCreateAutoTopUpConfigPayload,
} from './AutoTopUpModal.lib';
import type { TopUpPricingItem } from '@/components/wallets/TopUpModal/TopUpModal.lib';

const THRESHOLD = { amount: { quantity: '5.00', currency: 'EUR' } };

const walletWith = (configs: unknown[]) =>
    ({
        wallet_id: 'wall_1',
        wallet: { auto_top_up_configs: configs },
    }) as unknown as CustomerWalletBalanceItem;

const flexibleItem = (pricingItemId = 'prii_flexible', scheduleId: string | undefined = 'ppsc_1') =>
    ({
        pricingItemId,
        pricingPlanScheduleId: scheduleId,
        flexiblePricing: { currency: 'EUR', bounds: {} },
    }) as unknown as TopUpPricingItem;

const fixedItem = () =>
    ({
        pricingItemId: 'prii_fixed',
        pricingPlanScheduleId: 'ppsc_1',
        fixedPricing: { amount: { quantity: '10.00', currency: 'EUR' } },
    }) as unknown as TopUpPricingItem;

describe('getActiveAutoTopUpConfig', () => {
    it('finds the rule the wallet runs on', () => {
        const config = { id: 'atuc_1', status: 'ACTIVE' };

        expect(getActiveAutoTopUpConfig(walletWith([config]))).toBe(config);
    });

    // Turning a rule off leaves it behind for the top-ups charged under it, so it is history.
    it('ignores a rule that was switched off', () => {
        expect(getActiveAutoTopUpConfig(walletWith([{ status: 'INACTIVE' }]))).toBeUndefined();
    });

    it('has nothing to find on a wallet that never had one', () => {
        expect(getActiveAutoTopUpConfig(walletWith([]))).toBeUndefined();
        expect(getActiveAutoTopUpConfig()).toBeUndefined();
    });
});

describe('toAutoTopUpRule', () => {
    it('keeps only the two fields the editor owns', () => {
        const config = {
            id: 'atuc_1',
            wallet_id: 'wall_1',
            status: 'ACTIVE',
            threshold: THRESHOLD,
            pricing_item_id: 'prii_1',
            payment_method_id: 'pmet_1',
        } as never;

        expect(toAutoTopUpRule(config)).toEqual({ status: 'ACTIVE', threshold: THRESHOLD });
    });

    it('is nothing when the wallet has no rule', () => {
        expect(toAutoTopUpRule(undefined)).toBeUndefined();
    });
});

describe('getAutoTopUpChargeTarget', () => {
    it('takes the top-up the wallet row handed over', () => {
        const handed = {
            pricing_item_id: 'prii_handed',
            pricing_plan_schedule_id: 'ppsc_handed',
        } as ChargeOnDemandPricingItem;

        expect(getAutoTopUpChargeTarget(handed, [flexibleItem()])).toEqual({
            pricingItemId: 'prii_handed',
            pricingPlanScheduleId: 'ppsc_handed',
        });
    });

    // A rule tops up by an amount of its own, which a fixed pack cannot express.
    it("falls back to the wallet's choose-your-amount top-up", () => {
        expect(getAutoTopUpChargeTarget(undefined, [fixedItem(), flexibleItem()])).toEqual({
            pricingItemId: 'prii_flexible',
            pricingPlanScheduleId: 'ppsc_1',
        });
    });

    it('refuses a wallet that only offers fixed packs', () => {
        expect(getAutoTopUpChargeTarget(undefined, [fixedItem()])).toBeUndefined();
    });

    // Without a schedule the rule has nothing to bill against.
    it('refuses a top-up that names no schedule', () => {
        const handed = { pricing_item_id: 'prii_handed' } as ChargeOnDemandPricingItem;

        const scheduleless = {
            pricing_item_id: 'prii_flexible',
            flexiblePricing: { currency: 'EUR', bounds: {} },
        } as unknown as TopUpPricingItem;

        expect(getAutoTopUpChargeTarget(handed, [scheduleless])).toBeUndefined();
    });

    it('has nothing to charge when the wallet cannot be topped up', () => {
        expect(getAutoTopUpChargeTarget(undefined, [])).toBeUndefined();
    });
});

describe('toCreateAutoTopUpConfigPayload', () => {
    const complete = {
        rule: { status: 'ACTIVE' as const, threshold: THRESHOLD },
        walletBalanceItem: walletWith([]),
        chargeTarget: { pricingItemId: 'prii_1', pricingPlanScheduleId: 'ppsc_1' },
        paymentMethodId: 'pmet_1',
    };

    it('names every field the endpoint requires', () => {
        expect(toCreateAutoTopUpConfigPayload(complete)).toEqual({
            wallet_id: 'wall_1',
            status: 'ACTIVE',
            threshold: THRESHOLD,
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_item_id: 'prii_1',
            payment_method_id: 'pmet_1',
        });
    });

    it('carries a credits threshold through as credits', () => {
        const credits = { credits: { quantity: '500', credit_type_id: 'ctyp_1' } };

        expect(
            toCreateAutoTopUpConfigPayload({
                ...complete,
                rule: { status: 'ACTIVE', threshold: credits },
            })?.threshold,
        ).toEqual(credits);
    });

    it('saves a rule the customer switched off', () => {
        expect(
            toCreateAutoTopUpConfigPayload({
                ...complete,
                rule: { status: 'INACTIVE', threshold: THRESHOLD },
            })?.status,
        ).toBe('INACTIVE');
    });

    // Each of these is the customer's to finish rather than an error to report back to them.
    it('refuses a rule that does not validate', () => {
        expect(toCreateAutoTopUpConfigPayload({ ...complete, rule: undefined })).toBeUndefined();
    });

    it('refuses a rule with no threshold', () => {
        expect(
            toCreateAutoTopUpConfigPayload({
                ...complete,
                rule: { status: 'ACTIVE', threshold: {} },
            }),
        ).toBeUndefined();
    });

    it('refuses a rule with nothing to pay it with', () => {
        expect(
            toCreateAutoTopUpConfigPayload({ ...complete, paymentMethodId: undefined }),
        ).toBeUndefined();
    });

    it('refuses a rule with nothing to charge', () => {
        expect(
            toCreateAutoTopUpConfigPayload({ ...complete, chargeTarget: undefined }),
        ).toBeUndefined();
    });

    it('refuses a rule with no wallet to save it against', () => {
        expect(
            toCreateAutoTopUpConfigPayload({ ...complete, walletBalanceItem: undefined }),
        ).toBeUndefined();
    });
});
