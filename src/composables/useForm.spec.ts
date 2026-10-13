import { email, required } from '@vuelidate/validators';
import { nextTick } from 'vue';
import useForm from './useForm';

describe('useForm composable', () => {
    describe('form state', () => {
        it('returns the initial state', () => {
            const { form } = useForm({
                initialState: {
                    firstName: 'John',
                    infix: '',
                    lastName: 'Doe',
                },
                validationRules: {},
            });

            expect(form.value).toEqual({
                firstName: 'John',
                infix: '',
                lastName: 'Doe',
            });
        });
        it('invoking `updateInitialState` updates the initial state', () => {
            const { form, updateInitialState, changes } = useForm({
                initialState: {
                    firstName: 'John',
                    lastName: 'Doe',
                },
                validationRules: {},
            });

            expect(form.value).toEqual({
                firstName: 'John',
                lastName: 'Doe',
            });
            updateInitialState({
                firstName: 'Jane',
                lastName: 'Doe',
            });
            expect(form.value).toEqual({
                firstName: 'Jane',
                lastName: 'Doe',
            });
            expect(changes.value).toEqual({});
        });
    });
    describe('changes', () => {
        it('returns an empty record when there are no changes', () => {
            const { form, changes } = useForm({
                initialState: {
                    firstName: 'John',
                    lastName: 'Doe',
                },
                validationRules: {},
            });

            expect(form.value).toEqual({
                firstName: 'John',
                lastName: 'Doe',
            });
            expect(changes.value).toEqual({});
        });
        it('returns a record of changes when there are changes', () => {
            const { form, changes } = useForm({
                initialState: {
                    firstName: 'John',
                    infix: '',
                    lastName: 'Doe',
                },
                validationRules: {},
            });

            expect(form.value).toEqual({
                firstName: 'John',
                infix: '',
                lastName: 'Doe',
            });

            form.value.infix = 'van';

            expect(changes.value).toEqual({ infix: 'van' });
        });
    });
    describe('editing a field in place', () => {
        it('updates `changes` and `hasChanges` it has already computed', () => {
            const { form, changes, hasChanges } = useForm({
                initialState: { firstName: 'John', lastName: 'Doe' },
            });

            expect(hasChanges.value).toBe(false);

            form.value.firstName = 'Jane';

            expect(changes.value).toEqual({ firstName: 'Jane' });
            expect(hasChanges.value).toBe(true);
        });

        it('validates the edited value', async () => {
            const { form, validation } = useForm({
                initialState: { email: 'john@example.com' },
                validationRules: { email: { required, email } },
            });

            expect(await validation.value.$validate()).toBe(true);

            form.value.email = 'foo';
            await nextTick();

            expect(await validation.value.$validate()).toBe(false);
        });

        it('accepts a reactive state in `updateInitialState`', () => {
            const { form, updateInitialState, hasChanges } = useForm({
                initialState: { firstName: 'John' },
            });

            form.value.firstName = 'Jane';
            updateInitialState(form.value);

            expect(hasChanges.value).toBe(false);
            expect(form.value).toEqual({ firstName: 'Jane' });
        });
    });
});
