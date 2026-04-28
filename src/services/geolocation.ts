import type { CountryCode } from '@solvimon/solvimon-types';

export function createGeoLocationService() {
    return {
        /**
         * Get geolocation information from the user
         */
        getGeoLocation(): Promise<{ ip: string; country: CountryCode }> {
            return fetch(`https://api.country.is/`).then((response) => response.json());
        },
    };
}
