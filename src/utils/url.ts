export function getQueryParam(name: string, locationSearch = window.location.search) {
    const currentUrl = new URLSearchParams(locationSearch);
    return currentUrl.get(name);
}
