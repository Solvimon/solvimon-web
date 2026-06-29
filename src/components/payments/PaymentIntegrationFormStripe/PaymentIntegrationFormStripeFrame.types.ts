export type StripeFrameOptions =
    | { mode: 'setup'; currency: string; setup_future_usage?: 'off_session' }
    | { mode: 'payment'; currency: string; amount: number; setup_future_usage: 'off_session' };

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
