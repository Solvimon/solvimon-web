type StripeWalletsOption = { link?: 'never' | 'auto' };
type StripeFieldsOption = { billingDetails?: { address?: { country?: 'never' | 'auto' }; email?: 'never' | 'auto' } };
type StripeAppearanceOption = {
    variables?: { borderRadius?: string; [key: string]: string | undefined };
    rules?: { [selector: string]: { [property: string]: string } };
};

export type StripeFrameOptions =
    | { mode: 'setup'; currency: string; setup_future_usage?: 'off_session'; wallets?: StripeWalletsOption; fields?: StripeFieldsOption; appearance?: StripeAppearanceOption }
    | { mode: 'payment'; currency: string; amount: number; setup_future_usage: 'off_session'; wallets?: StripeWalletsOption; fields?: StripeFieldsOption; appearance?: StripeAppearanceOption };

export interface PaymentIntegrationFormStripeFrameProps {
    publicKey: string;
    options: StripeFrameOptions;
    countryCode?: string;
    email?: string;
}

export type PaymentIntegrationFormStripeFrameEmits = {
    ready: [];
    change: [paymentMethodType: string];
    loaderror: [error: { message?: string; type?: string }];
    'submit-success': [confirmationTokenId: string];
    'submit-error': [error: { message?: string; type?: string; code?: string }];
};
