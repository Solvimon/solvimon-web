import { uniqueId } from './uniqueId';

describe('uniqueId', () => {
    it('returns a different value on each call', () => {
        expect(uniqueId()).not.toBe(uniqueId());
    });

    it('prepends the prefix', () => {
        const id = uniqueId('foo-');
        expect(id.startsWith('foo-')).toBe(true);
    });

    it('appends a UUID', () => {
        const id = uniqueId('foo-');
        const uuid = id.replace('foo-', '');
        expect(uuid).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
    });

    it('works without a prefix', () => {
        const id = uniqueId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
});
