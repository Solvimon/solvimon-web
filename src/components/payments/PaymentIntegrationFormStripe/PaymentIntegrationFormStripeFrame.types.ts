import type { StripeError } from '@stripe/stripe-js';

type StripeWalletsOption = { link?: 'never' | 'auto' };
type StripeFieldsOption = {
    billingDetails?: {
        address?: { country?: 'never' | 'auto' };
        email?: 'never' | 'auto';
        name?: 'never' | 'auto';
    };
};
type StripeAppearanceOption = {
    variables?: { borderRadius?: string; [key: string]: string | undefined };
    rules?: { [selector: string]: { [property: string]: string } };
};

export type StripeFrameOptions =
    | {
          mode: 'setup';
          currency: string;
          setup_future_usage?: 'off_session';
          wallets?: StripeWalletsOption;
          fields?: StripeFieldsOption;
          appearance?: StripeAppearanceOption;
      }
    | {
          mode: 'payment';
          currency: string;
          amount: number;
          /** Only set when the method is to be kept: it is what asks Stripe to store it. */
          setup_future_usage?: 'off_session';
          wallets?: StripeWalletsOption;
          fields?: StripeFieldsOption;
          appearance?: StripeAppearanceOption;
      };

export interface PaymentIntegrationFormStripeFrameProps {
    publicKey: string;
    options: StripeFrameOptions;
    countryCode?: string;
    email?: string;
    name?: string;
}

export type StripeLoadError = Partial<Pick<StripeError, 'message' | 'type'>>;

export type StripeSubmitError = Partial<Pick<StripeError, 'message' | 'type' | 'code'>>;

export type PaymentIntegrationFormStripeFrameEmits = {
    ready: [];
    change: [paymentMethodType: string];
    loaderror: [error: StripeLoadError];
    'submit-success': [confirmationTokenId: string];
    'submit-error': [error: StripeSubmitError];
};
