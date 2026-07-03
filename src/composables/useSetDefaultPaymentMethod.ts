import type { PaymentMethod } from '@solvimon/solvimon-types';
import { useService } from '@/composables/useService';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export function useSetDefaultPaymentMethod() {
    const { setDefaultPaymentMethod } = createPaymentMethodsService();

    const { data, execute, error, isPending } = useService({
        service: (paymentMethodId: PaymentMethod['id']) =>
            setDefaultPaymentMethod({ paymentMethodId }),
    });

    return { data, execute, error, isPending };
}
