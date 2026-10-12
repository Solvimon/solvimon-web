import type { Error } from '@/types/errors';

export interface PaymentErrorCardProps {
    error: Error;
}

export interface PaymentErrorCardEmits {
    /**
     * The customer asked to try again. The form showing the card starts over itself: reloading the
     * page would hand a redirect return to the gateway a second time.
     */
    (e: 'retry'): void;
}
