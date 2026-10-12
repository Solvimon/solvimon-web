import { strong, toRichTextParts } from './CheckoutTitle.lib';

describe('strong', () => {
    it('joins the text it wraps into a marker', () => {
        expect(strong(['€', '10'])).toEqual({ strong: '€10' });
    });

    it('drops anything that is not text', () => {
        expect(strong(['€10', { strong: 'nested' }, 5])).toEqual({ strong: '€10' });
    });
});

describe('toRichTextParts', () => {
    it('reads a message without tags as one plain part', () => {
        expect(toRichTextParts('per month')).toEqual([{ text: 'per month', strong: false }]);
    });

    it('splits a message into plain and bold parts', () => {
        expect(toRichTextParts(['You pay ', { strong: '€10' }, ' today.'])).toEqual([
            { text: 'You pay ', strong: false },
            { text: '€10', strong: true },
            { text: ' today.', strong: false },
        ]);
    });

    it('keeps markup in a value as text', () => {
        expect(toRichTextParts(['a ', { strong: '<script>x</script>' }])).toEqual([
            { text: 'a ', strong: false },
            { text: '<script>x</script>', strong: true },
        ]);
    });

    it('drops empty strings and anything it does not recognise', () => {
        expect(toRichTextParts(['', { other: 'x' }, null, 'ok'])).toEqual([
            { text: 'ok', strong: false },
        ]);
    });
});
