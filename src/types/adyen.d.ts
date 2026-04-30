declare module '@adyen/adyen-web' {
    interface PaymentAction {
        data?: Record<string, unknown>;
    }
}

declare module '@adyen/adyen-web/auto' {
    interface PaymentAction {
        data?: Record<string, unknown>;
    }
}

export {};
