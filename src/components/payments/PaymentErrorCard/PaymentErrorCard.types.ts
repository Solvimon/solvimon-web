import type { SdkError } from '@/types/errors';

export interface PaymentErrorCardProps {
    error: SdkError;
}

export interface PaymentErrorCardEmits {
    /**
     * The customer asked to try again. The form showing the card starts over itself: reloading the
     * page would hand a redirect return to the gateway a second time.
     */
    (e: 'retry'): void;
}
