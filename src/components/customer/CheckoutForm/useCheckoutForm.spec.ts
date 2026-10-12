import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import { useCheckoutForm } from './useCheckoutForm';
import type { CheckoutFormState } from './CheckoutForm.types';

const { mockGetGeoLocation } = vi.hoisted(() => ({
    mockGetGeoLocation: vi.fn<() => Promise<{ country: string }>>(),
}));

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: vi.fn(() => ({ getGeoLocation: mockGetGeoLocation })),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
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
        mockGetGeoLocation.mockReset();
        mockGetGeoLocation.mockResolvedValue({ country: 'NL' });
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

    // Email comes before the country in the form, and does not change the preview on its own.
    it('calls onRequiredFieldChange when the country changes together with the email', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.email = 'first@example.com';
        await nextTick();
        vi.advanceTimersByTime(200);

        getResult().form.value.email = 'second@example.com';
        getResult().form.value.country = 'DE' as CountryCode;
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
    });

    // As when the geolocation fills in the country while the customer types their email.
    it('calls onRequiredFieldChange when the country changes earlier in the debounce window', async () => {
        const onRequiredFieldChange = vi.fn();
        const getResult = mountForm(onRequiredFieldChange);

        getResult().form.value.country = 'DE' as CountryCode;
        await nextTick();
        vi.advanceTimersByTime(100);
        getResult().form.value.email = 'customer@example.com';
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
        expect(onRequiredFieldChange).toHaveBeenCalledWith(
            expect.objectContaining({ country: 'DE' }),
        );
    });

    describe('country from the geolocation lookup', () => {
        const mountWithoutCountry = () => {
            let result: ReturnType<typeof useCheckoutForm> | undefined;
            mount(
                defineComponent({
                    setup() {
                        result = useCheckoutForm({
                            initialState: {},
                            onRequiredFieldChange: vi.fn(),
                        });
                    },
                    render: () => h('div'),
                }),
            );
            return () => result!;
        };

        it('fills in the country it names', async () => {
            mockGetGeoLocation.mockResolvedValueOnce({ country: 'DE' });
            const getResult = mountWithoutCountry();
            await flushPromises();

            expect(getResult().form.value.country).toBe('DE');
        });

        it('keeps a country the customer picked while it was out', async () => {
            let answer: (value: { country: string }) => void = () => {};
            mockGetGeoLocation.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
            const getResult = mountWithoutCountry();

            getResult().form.value.country = 'FR' as CountryCode;
            answer({ country: 'DE' });
            await flushPromises();

            expect(getResult().form.value.country).toBe('FR');
        });

        it('ignores a country it does not know', async () => {
            mockGetGeoLocation.mockResolvedValueOnce({ country: 'XX' });
            const getResult = mountWithoutCountry();
            await flushPromises();

            expect(getResult().form.value.country).toBeUndefined();
        });

        it('leaves the country empty when the lookup fails', async () => {
            mockGetGeoLocation.mockRejectedValueOnce(new TypeError('Failed to fetch'));
            const getResult = mountWithoutCountry();
            await flushPromises();

            expect(getResult().form.value.country).toBeUndefined();
        });
    });
});
