export type PromotionCodeSectionEmits = {
    (event: 'update:appliedCode', value: string | null): void;
    (event: 'apply', value: string): void;
    (event: 'remove'): void;
};

export type PromotionCodeSectionProps = {
    promotionCode?: string | null;
    /** Whether the checkout is still finding out if the code it was handed is accepted. */
    isPending?: boolean;
};
