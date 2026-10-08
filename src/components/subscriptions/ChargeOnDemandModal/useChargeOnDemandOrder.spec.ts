import type { Invoice } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import { useChargeOnDemandOrder } from './useChargeOnDemandOrder';
import { ApiError } from '@/services/apiError';

const { mockCharge, logger } = vi.hoisted(() => ({
    mockCharge: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ chargeOnDemandPricingItems: mockCharge }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => logger,
}));

const invoice = { id: 'inv_1', payment_status: 'PAID' } as Invoice;
const order = {
    pricingItems: [{ pricing_item_id: 'prii_1', units: { number: '2' } }],
    paymentMethodId: 'pmet_1',
};

const setup = () => useChargeOnDemandOrder({ pricingPlanScheduleId: ref('ppsc_1') });

describe('useChargeOnDemandOrder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCharge.mockResolvedValue(invoice);
    });

    it('charges the items to the payment method and finalizes the invoice', async () => {
        const { charge, chargedInvoice } = setup();

        expect(await charge(order)).toEqual({ invoice });
        expect(mockCharge).toHaveBeenCalledWith({
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_items: order.pricingItems,
            payment_method_id: 'pmet_1',
            finalize_immediately: true,
        });
        expect(chargedInvoice.value).toEqual(invoice);
    });

    it('is charging only while the request is out', async () => {
        const { charge, isCharging } = setup();

        const charged = charge(order);
        expect(isCharging.value).toBe(true);

        await charged;
        expect(isCharging.value).toBe(false);
    });

    it('reports a refused order as a warning, with what the API said', async () => {
        mockCharge.mockRejectedValue(
            new ApiError({ statusCode: 400, field: 'payment_method_id', requestId: 'req_1' }),
        );
        const { charge, chargeError } = setup();

        expect(await charge(order)).toEqual({ error: 'PAYMENT_METHOD' });
        expect(chargeError.value).toBe('PAYMENT_METHOD');
        expect(logger.warn).toHaveBeenCalledWith(
            'ON_DEMAND_CHARGE_REFUSED',
            expect.any(String),
            {
                scheduleId: 'ppsc_1',
                outcome: 'PAYMENT_METHOD',
                statusCode: 400,
                field: 'payment_method_id',
                requestId: 'req_1',
            },
            expect.any(ApiError),
        );
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('reports an order that may or may not have gone through as an error', async () => {
        const failure = new Error('network down');
        mockCharge.mockRejectedValue(failure);
        const { charge } = setup();

        expect(await charge(order)).toEqual({ error: 'FAILED' });
        expect(logger.error).toHaveBeenCalledWith(
            'ON_DEMAND_CHARGE_FAILED',
            expect.any(String),
            { scheduleId: 'ppsc_1', outcome: 'FAILED' },
            failure,
        );
    });

    it('clears the last order on reset', async () => {
        mockCharge.mockRejectedValueOnce(new ApiError({ statusCode: 422 }));
        const { charge, reset, chargedInvoice, chargeError } = setup();
        await charge(order);
        await charge(order);

        reset();

        expect(chargedInvoice.value).toBeUndefined();
        expect(chargeError.value).toBeUndefined();
    });
});
