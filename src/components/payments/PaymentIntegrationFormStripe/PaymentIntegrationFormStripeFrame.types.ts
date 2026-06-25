export type StripeFrameOptions =
    | { mode: 'setup'; currency: string }
    | { mode: 'payment'; currency: string; amount: number };

export interface PaymentIntegrationFormStripeFrameProps {
    publicKey: string;
    options: StripeFrameOptions;
}

export type PaymentIntegrationFormStripeFrameEmits = {
    ready: [];
    change: [paymentMethodType: string];
    loaderror: [error: { message?: string; type?: string }];
    'submit-success': [confirmationTokenId: string];
    'submit-error': [error: { message?: string; type?: string; code?: string }];
};
