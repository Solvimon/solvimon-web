import { reactive, ref } from 'vue';
import { asOptionalText, asText, formControlModel } from './formControl';

describe('form control utils', () => {
    describe('asText()', () => {
        it('keeps the text a control reported', () => {
            expect(asText('Amsterdam')).toBe('Amsterdam');
        });

        it('keeps an emptied field empty', () => {
            expect(asText('')).toBe('');
        });

        it('reads a number as its text', () => {
            expect(asText(42)).toBe('42');
        });

        it.each([[null], [undefined], [['a', 'b']]])(
            'falls back to empty text for %s, which a text field cannot hold',
            (value) => {
                expect(asText(value)).toBe('');
            },
        );
    });

    describe('asOptionalText()', () => {
        it('keeps the text a control reported', () => {
            expect(asOptionalText('NL123456789B01')).toBe('NL123456789B01');
        });

        it('keeps an emptied field distinct from an unset one', () => {
            expect(asOptionalText('')).toBe('');
        });

        it.each([[null], [undefined]])('stores nothing for %s', (value) => {
            expect(asOptionalText(value)).toBeUndefined();
        });
    });

    describe('formControlModel()', () => {
        const createState = () => ref<{ email: string; vatNumber?: string }>({ email: 'a@b.com' });

        it('reads the current field value', () => {
            const state = createState();
            const email = formControlModel(state, 'email', asText);
            const vatNumber = formControlModel(state, 'vatNumber', asOptionalText);

            expect(email.value).toBe('a@b.com');
            expect(vatNumber.value).toBeUndefined();
        });

        it('writes what the control reported back through the narrow function', () => {
            const state = createState();
            const email = formControlModel(state, 'email', asText);

            email.value = 'c@d.com';

            expect(state.value.email).toBe('c@d.com');
        });

        it('narrows a payload the field cannot hold', () => {
            const state = createState();
            const email = formControlModel(state, 'email', asText);
            const vatNumber = formControlModel(state, 'vatNumber', asOptionalText);

            email.value = null;
            vatNumber.value = null;

            expect(state.value.email).toBe('');
            expect(state.value.vatNumber).toBeUndefined();
        });

        it('tracks a field changed on the state itself', () => {
            const state = createState();
            const email = formControlModel(state, 'email', asText);

            state.value.email = 'e@f.com';

            expect(email.value).toBe('e@f.com');
        });

        it('unwraps and writes through once collected in a reactive object', () => {
            const state = createState();
            const fields = reactive({
                email: formControlModel(state, 'email', asText),
            });

            expect(fields.email).toBe('a@b.com');

            fields.email = 'g@h.com';

            expect(state.value.email).toBe('g@h.com');
        });
    });
});
