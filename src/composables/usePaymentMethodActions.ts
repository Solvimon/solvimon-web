import type { PaymentMethod } from '@solvimon/solvimon-types';
import { useService } from '@/composables/useService';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export function usePaymentMethodActions() {
    const { archivePaymentMethod, setDefaultPaymentMethod } = createPaymentMethodsService();

    const archiveRequest = useService({
        service: (paymentMethodId: PaymentMethod['id']) =>
            archivePaymentMethod({ paymentMethodId }),
    });

    const setDefaultRequest = useService({
        service: (paymentMethodId: PaymentMethod['id']) =>
            setDefaultPaymentMethod({ paymentMethodId }),
    });

    return {
        archive: archiveRequest.execute,
        archiveError: archiveRequest.error,
        isArchiving: archiveRequest.isPending,

        setDefault: setDefaultRequest.execute,
        setDefaultError: setDefaultRequest.error,
        isSettingDefault: setDefaultRequest.isPending,
    };
}
