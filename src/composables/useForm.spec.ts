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
        it('returns the initial state when `reset` is invoked', () => {
            const { form, reset } = useForm({
                initialState: {
                    firstName: '',
                    lastName: '',
                },
                validationRules: {},
            });

            expect(form.value).toEqual({
                firstName: '',
                lastName: '',
            });

            form.value.firstName = 'John';
            form.value.lastName = 'Doe';

            expect(form.value).toEqual({
                firstName: 'John',
                lastName: 'Doe',
            });

            reset();

            expect(form.value).toEqual({
                firstName: '',
                lastName: '',
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
});
