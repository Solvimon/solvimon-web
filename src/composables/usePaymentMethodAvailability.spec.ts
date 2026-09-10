import { nextTick, ref } from 'vue';
import { usePaymentMethodAvailability } from './usePaymentMethodAvailability';
import {
    createPaymentMethodOptionEntry,
    createPaymentMethodOptionsResponseWithoutOptions,
} from '@/test-utils/paymentMethodOptionsFixture';

const mockLogger = vi.hoisted(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
}));

vi.mock('@/components/providers', () => ({ useLogger: () => mockLogger }));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    async () => {
        const { ref: vueRef } = await import('vue');
        return { useExperimentalFeature: () => vueRef(null) };
    },
);

describe('usePaymentMethodAvailability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is LOADING while the options are still out, whatever it is holding', () => {
        const { availability } = usePaymentMethodAvailability({
            paymentMethodOptions: [],
            isLoading: true,
        });

        expect(availability.value).toBe('LOADING');
    });

    it('says nothing while loading, so a fetch in flight is never reported as broken', () => {
        usePaymentMethodAvailability({ paymentMethodOptions: [], isLoading: true });

        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('is READY when an entry would put a payment method on screen', () => {
        const { availability } = usePaymentMethodAvailability({
            paymentMethodOptions: [createPaymentMethodOptionEntry()],
            isLoading: false,
        });

        expect(availability.value).toBe('READY');
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('is UNAVAILABLE for an entry that arrived without its options array', () => {
        const { availability } = usePaymentMethodAvailability({
            paymentMethodOptions: createPaymentMethodOptionsResponseWithoutOptions(),
            isLoading: false,
        });

        expect(availability.value).toBe('UNAVAILABLE');
    });

    it('reports it grouped by acceptor, with the ids needed to chase it', () => {
        usePaymentMethodAvailability({
            paymentMethodOptions: createPaymentMethodOptionsResponseWithoutOptions({
                paymentAcceptorId: 'paya_AwDxO30vtnWSrDDSMG1J',
                integrationId: 'intg_9',
            }),
            isLoading: false,
            context: { invoiceId: 'invo_1', subscriptionId: 'ppsu_1' },
        });

        expect(mockLogger.error).toHaveBeenCalledOnce();
        expect(mockLogger.error).toHaveBeenCalledWith(
            'NO_PAYMENT_METHODS_AVAILABLE',
            expect.any(String),
            {
                fingerprint: ['NO_PAYMENT_METHODS_AVAILABLE', 'paya_AwDxO30vtnWSrDDSMG1J'],
                paymentAcceptorIds: ['paya_AwDxO30vtnWSrDDSMG1J'],
                integrationIds: ['intg_9'],
                invoiceId: 'invo_1',
                subscriptionId: 'ppsu_1',
            },
        );
    });

    it('groups an empty response under a placeholder rather than dropping the report', () => {
        usePaymentMethodAvailability({ paymentMethodOptions: [], isLoading: false });

        expect(mockLogger.error).toHaveBeenCalledWith(
            'NO_PAYMENT_METHODS_AVAILABLE',
            expect.any(String),
            expect.objectContaining({
                fingerprint: ['NO_PAYMENT_METHODS_AVAILABLE', 'no_payment_acceptor'],
            }),
        );
    });

    it('reports once as the fetch settles into unavailable, not once per re-render', async () => {
        const isLoading = ref(true);
        const paymentMethodOptions = ref(createPaymentMethodOptionsResponseWithoutOptions());

        usePaymentMethodAvailability({ paymentMethodOptions, isLoading });

        isLoading.value = false;
        await nextTick();
        paymentMethodOptions.value = [...paymentMethodOptions.value];
        await nextTick();

        expect(mockLogger.error).toHaveBeenCalledOnce();
    });

    it('reports again when a different acceptor turns out to be the broken one', async () => {
        const paymentMethodOptions = ref(
            createPaymentMethodOptionsResponseWithoutOptions({ paymentAcceptorId: 'paya_1' }),
        );

        usePaymentMethodAvailability({ paymentMethodOptions, isLoading: false });

        paymentMethodOptions.value = createPaymentMethodOptionsResponseWithoutOptions({
            paymentAcceptorId: 'paya_2',
        });
        await nextTick();

        expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });
});
