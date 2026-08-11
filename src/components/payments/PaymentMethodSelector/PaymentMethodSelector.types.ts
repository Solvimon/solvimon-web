import type { PaymentMethod } from '@solvimon/solvimon-types';
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
}

export interface PaymentMethodSelectorEmits {
    (e: 'update:modelValue', paymentMethodId: PaymentMethod['id'] | undefined): void;
    /**
     * The customer wants to pay with a method they have not saved yet. The form for adding one lives
     * with whoever owns the surrounding screen, since adding usually takes it over.
     */
    (e: 'add-payment-method'): void;
}
