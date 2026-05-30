import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import { useCheckoutForm } from './useCheckoutForm';
import type { CheckoutFormState } from './CheckoutForm.types';

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: vi.fn(() => ({
        getGeoLocation: vi.fn().mockResolvedValue({ country: 'NL' }),
    })),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>(
        '@solvimon/solvimon-ui',
    );
    return {
        ...actual,
        objectDiff: (opts: { from: Record<string, unknown>; to: Record<string, unknown> }) => {
            const diff: Record<string, unknown> = {};
            const keys = new Set([...Object.keys(opts.from), ...Object.keys(opts.to)]);
            for (const key of keys) {
                if (JSON.stringify(opts.from[key]) !== JSON.stringify(opts.to[key])) {
                    diff[key] = opts.to[key];
                }
            }
            return diff;
        },
    };
});

vi.mock('@solvimon/solvimon-ui/validators', () => ({
    taxId: { $validator: vi.fn(() => true) },
}));

const mountForm = (onRequiredFieldChange: (form: CheckoutFormState) => void) => {
    let result: ReturnType<typeof useCheckoutForm> | undefined;

    const Wrapper = defineComponent({
        setup() {
            result = useCheckoutForm({
                initialState: { country: 'NL' as CountryCode },
                onRequiredFieldChange,
            });
        },
        render: () => h('div'),
    });

    mount(Wrapper);
    return () => result!;
};

describe('useCheckoutForm', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls onRequiredFieldChange when a required field changes', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.country = 'DE' as CountryCode;
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalled();
    });

    it('calls onRequiredFieldChange when enabledPricingIds changes', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.enabledPricingIds = ['pricing_1', 'pricing_2'];
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalled();
    });

    it('calls onRequiredFieldChange when seatsValues changes', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.seatsValues = [{ pricing_item_config_id: 'cfg_1', number: '2' }];
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalled();
    });

    it('debounces rapid form changes into a single callback', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.country = 'DE' as CountryCode;
        await nextTick();
        getResult().form.value.country = 'FR' as CountryCode;
        await nextTick();
        getResult().form.value.country = 'BE' as CountryCode;
        await nextTick();

        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalledOnce();
    });

    it('does not call onRequiredFieldChange when no recognized field changes', async () => {
        const onRequiredFieldChange = vi.fn();
        mountForm(onRequiredFieldChange);

        // No changes made
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).not.toHaveBeenCalled();
    });
});
