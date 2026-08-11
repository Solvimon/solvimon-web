import { type Ref, watch } from 'vue';

export function useAutoApplyPromotionCode({
    subscription,
    promotionCode,
    appliedPromotionCode,
    applyPromotionCode,
}: {
    subscription: Ref<unknown>;
    promotionCode: string | undefined;
    appliedPromotionCode: Ref<string | null>;
    applyPromotionCode: (code: string) => void | Promise<void>;
}) {
    watch(
        subscription,
        (loadedSubscription) => {
            if (loadedSubscription && promotionCode) {
                appliedPromotionCode.value = promotionCode;
                void applyPromotionCode(promotionCode);
            }
        },
        { once: true },
    );
}
