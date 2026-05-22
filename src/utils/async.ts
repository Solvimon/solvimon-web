export function createLatestGuard() {
    let id = 0;
    return function capture() {
        const captured = ++id;
        return () => captured === id;
    };
}
