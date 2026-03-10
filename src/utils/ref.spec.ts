import { ref } from 'vue';
import { updateRefIfChanged } from './ref';

describe('ref utils', () => {
    describe('updateRefIfChanged()', () => {
        it('updates the ref when the value is different', () => {
            const r = ref(1);
            updateRefIfChanged(r, 2);
            expect(r.value).toBe(2);
        });

        it('does not update the ref when the value is the same (primitive)', () => {
            const r = ref(42);
            updateRefIfChanged(r, 42);
            expect(r.value).toBe(42);
        });

        it('does not update the ref when the value is deep-equal (object)', () => {
            const obj = { a: 1, b: { c: 2 } };
            const r = ref(obj);
            updateRefIfChanged(r, { a: 1, b: { c: 2 } });
            expect(r.value).toStrictEqual(obj);
            expect(r.value).toStrictEqual({ a: 1, b: { c: 2 } });
        });

        it('updates the ref when the value is not deep-equal (object)', () => {
            const r = ref({ a: 1 });
            const newVal = { a: 2 };
            updateRefIfChanged(r, newVal);
            expect(r.value).toStrictEqual({ a: 2 });
        });

        it('updates the ref when the value is different (array)', () => {
            const r = ref([1, 2]);
            const newVal = [1, 2, 3];
            updateRefIfChanged(r, newVal);
            expect(r.value).toStrictEqual([1, 2, 3]);
        });

        it('does not update the ref when the array is deep-equal', () => {
            const arr = [1, 2];
            const r = ref(arr);
            updateRefIfChanged(r, [1, 2]);
            expect(r.value).toStrictEqual([1, 2]);
        });
    });
});
