import type { PaymentMethod, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { RadioGroupExtendedProps } from '@solvimon/solvimon-ui';

export interface PaymentMethodSelectorProps {
    /**
     * The saved payment methods to choose from.
     */
    paymentMethods: PaymentMethod[];
    /**
     * Id of the currently selected payment method.
     */
    modelValue?: PaymentMethod['id'];
    /**
     * Optional label shown above the group.
     */
    label?: string;
    /**
     * Optionally specify if a choice is required or not.
     */
    required?: boolean;
    /**
     * Optionally disable the group and the add button.
     */
    disabled?: boolean;
    /**
     * Optional error message or vuelidate error object array, shown below the group.
     */
    error?: RadioGroupExtendedProps['error'];
    /**
     * Optional classes that will be applied to the root element.
     */
    rootClass?: string;
    /**
     * Whether to offer an "Add payment method" button below the saved methods, for when the customer
     * wants to pay with a method that is not saved yet.
     *
     * @default true
     */
    showAddOption?: boolean;
    /**
     * The methods the customer is allowed to add — card, direct debit, and so on. An empty list
     * means there is nothing to add, which is said in place of the button. Left out when the caller
     * has not looked them up, in which case adding stays on offer.
     */
    paymentMethodOptions?: PaymentMethodOptionsResponse;
}

export interface PaymentMethodSelectorEmits {
    (e: 'update:modelValue', paymentMethodId: PaymentMethod['id'] | undefined): void;
    /**
     * The customer wants to pay with a method they have not saved yet. The form for adding one lives
     * with whoever owns the surrounding screen, since adding usually takes it over.
     */
    (e: 'add-payment-method'): void;
}
