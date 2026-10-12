import { type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

export function useAutoApplyPromotionCode({
    subscription,
    promotionCode,
    appliedPromotionCode,
    applyPromotionCode,
}: {
    subscription: Ref<unknown>;
    /** Read once the subscription has loaded, so a code the host sets before then is applied. */
    promotionCode: MaybeRefOrGetter<string | undefined>;
    appliedPromotionCode: Ref<string | null>;
    applyPromotionCode: (code: string) => void | Promise<void>;
}) {
    watch(
        subscription,
        (loadedSubscription) => {
            const code = toValue(promotionCode);

            if (loadedSubscription && code) {
                appliedPromotionCode.value = code;
                void applyPromotionCode(code);
            }
        },
        { once: true },
    );
}
