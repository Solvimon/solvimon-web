import type { Customer } from '@solvimon/solvimon-types';
import { flushPromises } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { useCustomerPaymentMethodOptions } from './useCustomerPaymentMethodOptions';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./usePaymentMethodOptions', async () => {
    const { ref: createRef } = await import('vue');

    return {
        usePaymentMethodOptions: () => ({
            paymentMethodOptions: createRef([{ id: 'pmo_card' }]),
            get: mockGet,
            isPending: createRef(false),
        }),
    };
});

const CUSTOMER = {
    id: 'cust_1',
    type: 'ORGANIZATION',
    organization: { registered_address: { country: 'NL' } },
} as unknown as Customer;

const setup = ({
    isOpen = false,
    customer = CUSTOMER as Customer | null,
    subscriptionId = undefined as string | undefined,
    onError = undefined as ((error: unknown) => void) | undefined,
} = {}) => {
    const open = ref(isOpen);
    // Null rather than undefined, which a default parameter would fill back in.
    const currentCustomer = ref(customer ?? undefined);

    return {
        open,
        currentCustomer,
        ...useCustomerPaymentMethodOptions({
            isOpen: open,
            customer: currentCustomer,
            subscriptionId: ref(subscriptionId),
            onError,
        }),
    };
};

describe('useCustomerPaymentMethodOptions', () => {
    beforeEach(() => {
        mockGet.mockReset();
    });

    // A host that has not been opened has been given no customer to ask about.
    it('asks for nothing while it is closed', () => {
        setup();

        expect(mockGet).not.toHaveBeenCalled();
    });

    it('asks for nothing without a customer to ask about', () => {
        setup({ isOpen: true, customer: null });

        expect(mockGet).not.toHaveBeenCalled();
    });

    it('asks for the customer options once it opens', async () => {
        const { open } = setup();

        open.value = true;
        await nextTick();

        expect(mockGet).toHaveBeenCalledWith({ customerId: 'cust_1', country: 'NL' });
    });

    it('asks straight away where it is already open', () => {
        setup({ isOpen: true });

        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('asks again for another customer', async () => {
        const { currentCustomer } = setup({ isOpen: true });

        currentCustomer.value = { ...CUSTOMER, id: 'cust_2' };
        await nextTick();

        expect(mockGet).toHaveBeenLastCalledWith({ customerId: 'cust_2', country: 'NL' });
    });

    it("narrows the options to a subscription's", () => {
        setup({ isOpen: true, subscriptionId: 'ppsu_1' });

        expect(mockGet).toHaveBeenCalledWith({
            customerId: 'cust_1',
            subscriptionId: 'ppsu_1',
            country: 'NL',
        });
    });

    it('reports a failed lookup and asks again when told to', async () => {
        const error = new Error('gateway down');
        mockGet.mockRejectedValueOnce(error);
        const onError = vi.fn();
        const { load } = setup({ isOpen: true, onError });
        await flushPromises();

        expect(onError).toHaveBeenCalledWith(error);

        await load();

        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('hands the options on to whoever asked for them', () => {
        expect(setup({ isOpen: true }).paymentMethodOptions.value).toEqual([{ id: 'pmo_card' }]);
    });
});
