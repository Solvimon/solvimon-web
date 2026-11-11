/**
 * Billing helpers (`/billing`) for ordering on-demand items: which items can be ordered, which
 * saved payment methods can pay, and the charge request's `pricing_items`.
 */
import type {
    Amount,
    ChargeOnDemandPricingItemsPricingItemConfig,
    OnDemandPricingItemsResponse,
    PaymentAcceptor,
    PaymentMethod,
    Pricing,
    PricingItem,
    PricingItemConfig,
    PricingPlanSubscription,
    PricingPlanVersionExtended,
} from '@solvimon/solvimon-types';
import {
    getAllPricings,
    getComposedString,
    hasOneOfPricingTypes,
    type ChargeOnDemandItem,
    type ChargeOnDemandPriceType,
    type ChargeOnDemandSelectionItem,
} from '@solvimon/solvimon-ui';
import { isPayablePaymentMethod } from '@/utils/paymentMethods';

const CHARGEABLE_PRICE_TYPES: ChargeOnDemandPriceType[] = ['FIXED', 'FLAT', 'FLEXIBLE'];

const getConfigPrice = (config: PricingItemConfig, priceType: ChargeOnDemandPriceType) => {
    const band = config.details.bands?.[0];
    return priceType === 'FIXED' ? band?.fixed_amount : band?.amount;
};

/** Whether `units` is a quantity a FLAT item can be ordered in: a whole number of 1 or more. */
export const isOrderableUnits = (units: number | undefined): units is number =>
    typeof units === 'number' && Number.isInteger(units) && units >= 1;

/**
 * Whether `amount` is one a FLEXIBLE item can be ordered at: in its currency, above zero and
 * within its bounds, the checks the charge makes too.
 */
export const isOrderableAmount = (
    amount: Amount | undefined,
    flexiblePricing: ChargeOnDemandItem['flexiblePricing'],
): amount is Amount => {
    const quantity = Number(amount?.quantity);
    const { minimum_amount, maximum_amount } = flexiblePricing?.config ?? {};

    return (
        !!amount &&
        amount.currency === flexiblePricing?.currency &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        (!minimum_amount || quantity >= Number(minimum_amount.quantity)) &&
        (!maximum_amount || quantity <= Number(maximum_amount.quantity))
    );
};

const getFlexiblePricing = (config: PricingItemConfig): ChargeOnDemandItem['flexiblePricing'] => {
    const { minimum_amount, maximum_amount } = config.details.bands?.[0] ?? {};
    const currency = minimum_amount?.currency ?? maximum_amount?.currency;

    return currency
        ? {
              config: {
                  ...(minimum_amount && { minimum_amount }),
                  ...(maximum_amount && { maximum_amount }),
              },
              currency,
          }
        : undefined;
};

const getDefaultUnits = (config: PricingItemConfig): number => {
    const defaultUnits = Number(config.default_units?.number);
    return isOrderableUnits(defaultUnits) ? defaultUnits : 1;
};

/**
 * The names of the products and product items of a subscription's expanded pricing plan
 * versions, by id.
 */
const getNamesById = (
    pricingPlanVersions: Pick<PricingPlanVersionExtended, 'pricing_categories'>[],
) => {
    const pricings = pricingPlanVersions.flatMap(getAllPricings);

    return {
        productItems: new Map(
            pricings
                .flatMap((pricing) => pricing.items ?? [])
                .flatMap((item) => item.product_items ?? [])
                .map(({ id, name }) => [id, name]),
        ),
        products: new Map(
            pricings.flatMap((pricing) => pricing.products ?? []).map(({ id, name }) => [id, name]),
        ),
    };
};

/**
 * An on-demand item named the way the pricing detail heads a pricing item: by its product
 * items. A pricing item whose product items cannot be found is named by its pricing, else by
 * the pricing's products.
 */
const getOnDemandItemName = (
    pricing: Pricing,
    item: PricingItem,
    namesById: ReturnType<typeof getNamesById>,
) =>
    getComposedString(item.product_item_ids.map((id) => namesById.productItems.get(id))) ||
    pricing.name ||
    getComposedString(pricing.product_ids.map((id) => namesById.products.get(id))) ||
    '';

const toChargeOnDemandItem = (
    pricing: Pricing,
    item: PricingItem,
    namesById: ReturnType<typeof getNamesById>,
): ChargeOnDemandItem | undefined => {
    const config = item.configs?.find((candidate) => candidate.on_demand);

    if (
        !config ||
        config.wallet_grants?.length ||
        !hasOneOfPricingTypes(config, CHARGEABLE_PRICE_TYPES)
    ) {
        return undefined;
    }

    if (config.details.pricing_type === 'FLEXIBLE') {
        const flexiblePricing = getFlexiblePricing(config);

        // An amount can only be entered in a currency the band names.
        return flexiblePricing
            ? {
                  pricingItemId: item.id,
                  pricingItemConfigId: config.id,
                  name: getOnDemandItemName(pricing, item, namesById),
                  priceType: 'FLEXIBLE',
                  defaultUnits: 1,
                  flexiblePricing,
              }
            : undefined;
    }

    const priceType: ChargeOnDemandPriceType =
        config.details.pricing_type === 'FIXED' ? 'FIXED' : 'FLAT';

    return {
        pricingItemId: item.id,
        pricingItemConfigId: config.id,
        name: getOnDemandItemName(pricing, item, namesById),
        priceType,
        price: getConfigPrice(config, priceType),
        defaultUnits: getDefaultUnits(config),
    };
};

/**
 * The items of an on-demand pricing items response that can be ordered: items whose on-demand
 * config is priced FIXED, FLAT or FLEXIBLE and grants no wallet credits. A FLEXIBLE item is
 * paid an amount the customer chooses.
 *
 * Items are named from `pricingPlanVersions`, expanded versions of the same subscription, because
 * the response does not expand products or product items. They are matched by product and product
 * item id: the response lists the schedule's combined version, where an overridden pricing item
 * has an id of its own.
 */
export const getChargeableOnDemandItems = (
    response: OnDemandPricingItemsResponse | undefined,
    {
        pricingPlanVersions = [],
    }: {
        pricingPlanVersions?: Pick<PricingPlanVersionExtended, 'pricing_categories'>[];
    } = {},
): ChargeOnDemandItem[] => {
    const namesById = getNamesById(pricingPlanVersions);

    return getAllPricings(response).flatMap((pricing) =>
        (pricing.items ?? []).flatMap(
            (item) => toChargeOnDemandItem(pricing, item, namesById) ?? [],
        ),
    );
};

/**
 * The customer's saved payment methods that can pay an on-demand charge on the subscription,
 * with the subscription's own payment method first. The charge accepts a method whose
 * integration is the payment gateway of one of the subscription's payment acceptors, and only
 * an ACTIVE method that has not expired can pay.
 */
export const getPayablePaymentMethods = (
    paymentMethods: PaymentMethod[],
    subscription: Pick<PricingPlanSubscription, 'payment_method_id'> & {
        payment_acceptors?: {
            id: PaymentAcceptor['id'];
            payment_gateway?: { integration_id?: string };
        }[];
    },
): PaymentMethod[] => {
    const integrationIds = new Set(
        (subscription.payment_acceptors ?? []).flatMap(
            (acceptor) => acceptor.payment_gateway?.integration_id ?? [],
        ),
    );

    return paymentMethods
        .filter(
            (paymentMethod) =>
                isPayablePaymentMethod(paymentMethod) &&
                !!paymentMethod.integration_id &&
                integrationIds.has(paymentMethod.integration_id),
        )
        .sort(
            (a, b) =>
                Number(b.id === subscription.payment_method_id) -
                Number(a.id === subscription.payment_method_id),
        );
};

/**
 * The `pricing_items` of a charge on demand request, in the order the items were added. The
 * backend reports an item's errors by its index here, rejects `units` on anything but FLAT, and
 * requires `flexible_amount` on FLEXIBLE. Units and amounts are sent as entered: the order
 * validates them with `isOrderableUnits` and `isOrderableAmount` before it previews or charges, so
 * a quantity or amount the customer did not choose is never charged.
 */
export const toChargePricingItems = (
    selection: ChargeOnDemandSelectionItem[],
    items: ChargeOnDemandItem[],
): ChargeOnDemandPricingItemsPricingItemConfig[] =>
    selection.flatMap(({ pricingItemId, units, amount }) => {
        const item = items.find((candidate) => candidate.pricingItemId === pricingItemId);
        if (!item) {
            return [];
        }

        if (item.priceType === 'FLEXIBLE' && amount) {
            return [{ pricing_item_id: pricingItemId, flexible_amount: amount }];
        }

        return item.priceType === 'FLAT' && units !== undefined
            ? [{ pricing_item_id: pricingItemId, units: { number: String(units) } }]
            : [{ pricing_item_id: pricingItemId }];
    });
