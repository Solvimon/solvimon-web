import { nextTick, ref } from 'vue';
import { usePaymentFormHold } from './usePaymentFormHold';

describe('usePaymentFormHold', () => {
    it('holds the form while a payment is on its way', () => {
        const isPaymentPending = ref(false);
        const { isFormHeld } = usePaymentFormHold(isPaymentPending);

        expect(isFormHeld.value).toBe(false);
        isPaymentPending.value = true;
        expect(isFormHeld.value).toBe(true);
    });

    // A held form put a 3DS challenge drawn inside it out of the customer's reach.
    it('lets go while the gateway waits on the customer', () => {
        const { isFormHeld, handleActionRequired } = usePaymentFormHold(ref(true));

        handleActionRequired();

        expect(isFormHeld.value).toBe(false);
    });

    it('holds the next payment again once the last one is over', async () => {
        const isPaymentPending = ref(true);
        const { isFormHeld, handleActionRequired } = usePaymentFormHold(isPaymentPending);
        handleActionRequired();

        isPaymentPending.value = false;
        await nextTick();
        isPaymentPending.value = true;

        expect(isFormHeld.value).toBe(true);
    });
});
