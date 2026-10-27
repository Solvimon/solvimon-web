import { shallowRef, watch, type WatchSource } from 'vue';
import {
    getAddressFormat,
    loadAddressFormats,
    type AddressFormat,
    type AddressFormatTable,
} from './addressFormat';

/**
 * The per-country address formats, which are a chunk of their own and only downloaded once a form
 * needs them. One that does not download leaves the fields asking only for what every country
 * needs, and is tried again on the next change of a watched country.
 */
export function useAddressFormats({
    isNeeded,
    countries,
}: {
    isNeeded: () => boolean;
    countries: WatchSource<string | undefined>[];
}) {
    const addressFormats = shallowRef<AddressFormatTable>();

    let isLoading = false;

    watch(
        [isNeeded, ...countries],
        () => {
            if (!isNeeded() || addressFormats.value || isLoading) return;

            isLoading = true;
            loadAddressFormats()
                .then((formats) => {
                    addressFormats.value = formats;
                })
                .catch(() => {
                    // The fallback rules apply until then.
                })
                .finally(() => {
                    isLoading = false;
                });
        },
        { immediate: true },
    );

    const formatOf = (country: string | undefined): AddressFormat | undefined =>
        addressFormats.value ? getAddressFormat(addressFormats.value, country) : undefined;

    return { formatOf };
}
