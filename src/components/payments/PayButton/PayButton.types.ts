import type { Amount } from '@solvimon/solvimon-types';
import type { ButtonProps } from '@solvimon/solvimon-ui';
import type { SelectedPaymentMethod } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

export interface PayButtonProps extends ButtonProps {
    amount?: Amount;
    paymentMethod?: SelectedPaymentMethod;
    /** Names a stored method, "Visa •••• 4242", in place of the type of `paymentMethod`. */
    paymentMethodLabel?: string;
}

export interface PayButtonEmits {
    click: [event: MouseEvent];
}
