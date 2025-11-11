export function createGeoLocationService() {
    return {
        /**
         * Get geolocation information from the user
         */
        getGeoLocation(): Promise<{ ip: string; country: string }> {
            return fetch(`https://api.country.is/`).then((response) => response.json());
        },
    };
}
