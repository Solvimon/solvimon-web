import type { PublicEnvironment } from '@/types/environment';

export interface SolvimonAddPaymentMethodFormProps {
    token: string;
    environment: PublicEnvironment;
    onError?: () => string;
}
