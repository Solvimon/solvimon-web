export type PromotionCodeSectionEmits = {
    (event: 'update:appliedCode', value: string | null): void;
    (event: 'apply', value: string): void;
    (event: 'remove'): void;
};

export type PromotionCodeSectionProps = {
    promotionCode?: string | null;
};
