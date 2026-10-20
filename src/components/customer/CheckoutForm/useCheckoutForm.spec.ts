import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import * as addressFormat from './addressFormat';
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

const mountForm = (
    onRequiredFieldChange: (form: CheckoutFormState) => void,
    { isShippingAddressRequired = false }: { isShippingAddressRequired?: boolean } = {},
) => {
    let result: ReturnType<typeof useCheckoutForm> | undefined;

    const Wrapper = defineComponent({
        setup() {
            result = useCheckoutForm({
                initialState: { country: 'NL' as CountryCode },
                onRequiredFieldChange,
                isShippingAddressRequired,
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
        const mountWithoutCountry = ({ isShippingAddressRequired = false } = {}) => {
            let result: ReturnType<typeof useCheckoutForm> | undefined;
            mount(
                defineComponent({
                    setup() {
                        result = useCheckoutForm({
                            initialState: {},
                            onRequiredFieldChange: vi.fn(),
                            isShippingAddressRequired,
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

        it('fills in the shipping country too for a shipped order', async () => {
            mockGetGeoLocation.mockResolvedValueOnce({ country: 'DE' });
            const getResult = mountWithoutCountry({ isShippingAddressRequired: true });
            await flushPromises();

            expect(getResult().form.value.shippingCountry).toBe('DE');
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

    // The preview is asked for 200ms after the last change; a payment in between would carry the
    // price of the form before it.
    describe('a change the preview has not been asked for yet', () => {
        it('marks the preview stale from the change until it is asked for', async () => {
            const onRequiredFieldChange = vi.fn();
            const getResult = mountForm(onRequiredFieldChange);

            getResult().form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '5' }];
            await nextTick();

            expect(getResult().isPreviewStale.value).toBe(true);
            expect(onRequiredFieldChange).not.toHaveBeenCalled();

            vi.advanceTimersByTime(200);

            expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
            expect(getResult().isPreviewStale.value).toBe(false);
        });

        it('does not mark it stale for a change that leaves the price as it is', async () => {
            const getResult = mountForm(vi.fn());

            getResult().form.value.email = 'customer@example.com';
            await nextTick();

            expect(getResult().isPreviewStale.value).toBe(false);
        });

        it('asks for the preview at once when flushed, and only once', async () => {
            const onRequiredFieldChange = vi.fn();
            const getResult = mountForm(onRequiredFieldChange);

            getResult().form.value.country = 'DE' as CountryCode;
            await nextTick();
            getResult().flushPreviewChange();

            expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
            expect(onRequiredFieldChange).toHaveBeenCalledWith(
                expect.objectContaining({ country: 'DE' }),
            );
            expect(getResult().isPreviewStale.value).toBe(false);

            vi.advanceTimersByTime(200);
            expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
        });

        it('asks for nothing when flushed with no change held back', () => {
            const onRequiredFieldChange = vi.fn();
            const getResult = mountForm(onRequiredFieldChange);

            getResult().flushPreviewChange();

            expect(onRequiredFieldChange).not.toHaveBeenCalled();
        });
    });

    describe('shipping address', () => {
        it('asks nothing of the shipping fields for an order that is not shipped', () => {
            const getResult = mountForm(vi.fn());

            expect(getResult().getIsShippingFieldRequired('shippingAddressLine1')).toBe(false);
            expect(getResult().validation.value.shippingAddressLine1.$invalid).toBe(false);
        });

        it('insists on what a parcel needs once the order is shipped', () => {
            const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });
            const isRequired = getResult().getIsShippingFieldRequired;

            expect(isRequired('shippingAddressLine1')).toBe(true);
            expect(isRequired('shippingPostalCode')).toBe(true);
            expect(isRequired('shippingCity')).toBe(true);
            expect(isRequired('shippingCountry')).toBe(true);
            expect(isRequired('shippingPhoneNumber')).toBe(true);
            expect(isRequired('shippingAddressLine2')).toBe(false);
        });

        it('asks for a state where the destination country wants one', async () => {
            const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });

            expect(getResult().getIsShippingFieldRequired('shippingState')).toBe(false);

            getResult().form.value.shippingCountry = 'CA' as CountryCode;
            await nextTick();

            expect(getResult().getIsShippingFieldRequired('shippingState')).toBe(true);
        });

        it('tries the address formats again after a failed download', async () => {
            const formats = await import('./addressFormats.data');
            const load = vi
                .spyOn(addressFormat, 'loadAddressFormats')
                .mockRejectedValueOnce(new Error('chunk failed'))
                .mockResolvedValueOnce(formats);
            const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });
            await flushPromises();

            getResult().form.value.shippingCountry = 'HK' as CountryCode;
            await nextTick();
            await flushPromises();

            expect(load).toHaveBeenCalledTimes(2);
            expect(getResult().getIsShippingFieldRequired('shippingPostalCode')).toBe(false);
            load.mockRestore();
        });

        it('reports a shipped order with no address as invalid', async () => {
            const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });

            await getResult().validation.value.$validate();

            expect(getResult().validation.value.shippingAddressLine1.$invalid).toBe(true);
        });

        describe('billing to the shipping address', () => {
            it('bills where the order ships by default', () => {
                const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });

                expect(getResult().form.value.billingAddressSameAsShipping).toBe(true);
            });

            it('follows the shipping address while it does', async () => {
                const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });

                getResult().form.value.shippingAddressLine1 = 'Main street 1';
                getResult().form.value.shippingPostalCode = '1000AA';
                getResult().form.value.shippingCity = 'Amsterdam';
                getResult().form.value.shippingCountry = 'DE' as CountryCode;
                await nextTick();

                expect(getResult().form.value.addressLine1).toBe('Main street 1');
                expect(getResult().form.value.postalCode).toBe('1000AA');
                expect(getResult().form.value.city).toBe('Amsterdam');
                expect(getResult().form.value.country).toBe('DE');
            });

            it('leaves the billing address alone once the customer takes it apart', async () => {
                const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });

                getResult().form.value.shippingAddressLine1 = 'Main street 1';
                await nextTick();

                getResult().form.value.billingAddressSameAsShipping = false;
                getResult().form.value.addressLine1 = 'Invoice street 2';
                await nextTick();

                getResult().form.value.shippingAddressLine1 = 'Main street 3';
                await nextTick();

                expect(getResult().form.value.addressLine1).toBe('Invoice street 2');
            });

            // A shipped order is taxed where it ships.
            it('re-prices the order when the shipping country changes', async () => {
                const onRequiredFieldChange = vi.fn();
                const getResult = mountForm(onRequiredFieldChange, {
                    isShippingAddressRequired: true,
                });

                getResult().form.value.shippingCountry = 'DE' as CountryCode;
                await nextTick();
                vi.advanceTimersByTime(200);

                expect(onRequiredFieldChange).toHaveBeenCalled();
            });
        });

        describe('billing to another address', () => {
            it('re-prices the order when the shipping country changes', async () => {
                const onRequiredFieldChange = vi.fn();
                const getResult = mountForm(onRequiredFieldChange, {
                    isShippingAddressRequired: true,
                });
                getResult().form.value.billingAddressSameAsShipping = false;
                await nextTick();
                vi.advanceTimersByTime(200);
                onRequiredFieldChange.mockClear();

                getResult().form.value.shippingCountry = 'DE' as CountryCode;
                await nextTick();
                vi.advanceTimersByTime(200);

                expect(onRequiredFieldChange).toHaveBeenCalledTimes(1);
            });

            it('leaves the price alone when only the billing country changes', async () => {
                const onRequiredFieldChange = vi.fn();
                const getResult = mountForm(onRequiredFieldChange, {
                    isShippingAddressRequired: true,
                });
                getResult().form.value.billingAddressSameAsShipping = false;
                await nextTick();
                vi.advanceTimersByTime(200);
                onRequiredFieldChange.mockClear();

                getResult().form.value.country = 'DE' as CountryCode;
                await nextTick();
                vi.advanceTimersByTime(200);

                expect(onRequiredFieldChange).not.toHaveBeenCalled();
            });

            const mountBilledElsewhere = async () => {
                const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });
                getResult().form.value.billingAddressSameAsShipping = false;
                await flushPromises();
                return getResult;
            };

            it('asks the billing address for a street, postal code and city', async () => {
                const getResult = await mountBilledElsewhere();
                const isRequired = getResult().getIsBillingFieldRequired;

                expect(isRequired('addressLine1')).toBe(true);
                expect(isRequired('postalCode')).toBe(true);
                expect(isRequired('city')).toBe(true);
                expect(isRequired('addressLine2')).toBe(false);
                expect(isRequired('state')).toBe(false);
            });

            it('asks for a state where the billing country wants one', async () => {
                const getResult = await mountBilledElsewhere();

                getResult().form.value.country = 'US' as CountryCode;
                await flushPromises();

                expect(getResult().getIsBillingFieldRequired('state')).toBe(true);
            });

            it('reports a billing address without a city as invalid', async () => {
                const getResult = await mountBilledElsewhere();

                await getResult().validation.value.$validate();

                expect(getResult().validation.value.city.$invalid).toBe(true);
            });

            it("rejects a postal code that does not fit the billing country's format", async () => {
                const getResult = await mountBilledElsewhere();

                getResult().form.value.postalCode = '12345';
                await flushPromises();
                await getResult().validation.value.$validate();

                expect(getResult().validation.value.postalCode.$errors[0]?.$validator).toBe(
                    'postalCodeFormat',
                );
            });

            it('keeps the billing rules of an order billed where it ships', async () => {
                const getResult = mountForm(vi.fn(), { isShippingAddressRequired: true });
                await flushPromises();

                expect(getResult().getIsBillingFieldRequired('city')).toBe(false);
            });

            it('keeps the billing rules of an order that is not shipped', () => {
                const getResult = mountForm(vi.fn());

                expect(getResult().getIsBillingFieldRequired('city')).toBe(false);
                expect(getResult().getIsBillingFieldRequired('addressLine1')).toBe(false);
            });
        });

        it('leaves the billing address alone for an order that is not shipped', async () => {
            const getResult = mountForm(vi.fn());

            getResult().form.value.shippingAddressLine1 = 'Main street 1';
            await nextTick();

            expect(getResult().form.value.addressLine1).toBeUndefined();
        });
    });
});
