import { describe, expect, it } from 'vitest';
import { parseMarkdownSubset, type MarkdownInlineNode } from './markdownSubset';

const inline = (source: string) => parseMarkdownSubset(source)[0]?.children ?? [];

/** The rendered text, which is what a customer actually reads. */
const textOf = (nodes: MarkdownInlineNode[]): string =>
    nodes
        .map((node) => {
            if (node.type === 'text') return node.value;
            if (node.type === 'break') return '\n';
            return textOf(node.children);
        })
        .join('');

describe('parseMarkdownSubset', () => {
    it('returns nothing for an empty note', () => {
        expect(parseMarkdownSubset(undefined)).toEqual([]);
        expect(parseMarkdownSubset(null)).toEqual([]);
        expect(parseMarkdownSubset('   \n  ')).toEqual([]);
    });

    it('reads plain text', () => {
        expect(inline('By subscribing you agree.')).toEqual([
            { type: 'text', value: 'By subscribing you agree.' },
        ]);
    });

    it('splits paragraphs on a blank line and keeps single breaks', () => {
        const paragraphs = parseMarkdownSubset('First line\nsame paragraph\n\nSecond paragraph');

        expect(paragraphs).toHaveLength(2);
        expect(textOf(paragraphs[0].children)).toBe('First line\nsame paragraph');
        expect(textOf(paragraphs[1].children)).toBe('Second paragraph');
    });

    it('reads the three emphases the editor can produce', () => {
        expect(inline('**bold**')).toEqual([
            { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
        ]);
        expect(inline('*italic*')).toEqual([
            { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
        ]);
        expect(inline('_italic_')).toEqual([
            { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
        ]);
        expect(inline('<u>underline</u>')).toEqual([
            { type: 'underline', children: [{ type: 'text', value: 'underline' }] },
        ]);
    });

    it('does not read bold as two italics', () => {
        expect(inline('**bold**')[0].type).toBe('bold');
    });

    it('reads a link, and an autolink whose text is its own href', () => {
        expect(inline('[Terms](https://example.com/terms)')).toEqual([
            {
                type: 'link',
                href: 'https://example.com/terms',
                children: [{ type: 'text', value: 'Terms' }],
            },
        ]);
        expect(inline('<https://example.com/terms>')).toEqual([
            {
                type: 'link',
                href: 'https://example.com/terms',
                children: [{ type: 'text', value: 'https://example.com/terms' }],
            },
        ]);
    });

    it('nests, so a link can carry emphasis', () => {
        expect(inline('[**Terms**](https://example.com)')).toEqual([
            {
                type: 'link',
                href: 'https://example.com',
                children: [{ type: 'bold', children: [{ type: 'text', value: 'Terms' }] }],
            },
        ]);
    });

    it('keeps surrounding text', () => {
        expect(textOf(inline('Read the [terms](https://example.com) before paying.'))).toBe(
            'Read the terms before paying.',
        );
    });

    describe('a note is written by a merchant and read by their customers', () => {
        it('never produces a node type the renderer does not know', () => {
            const nodes = inline(
                '<script>alert(1)</script> <img src=x onerror=alert(1)> <iframe></iframe>',
            );
            const allowed = ['text', 'break', 'bold', 'italic', 'underline', 'link'];

            expect(nodes.every((node) => allowed.includes(node.type))).toBe(true);
        });

        it('leaves raw HTML as text rather than markup', () => {
            expect(inline('<script>alert(1)</script>')).toEqual([
                { type: 'text', value: '<script>alert(1)</script>' },
            ]);
        });

        it('refuses a javascript: href, keeping the words and dropping the payload', () => {
            // eslint-disable-next-line no-script-url -- the vector under test
            const nodes = inline('[Click me](javascript:alert(1))');

            expect(nodes.every((node) => node.type !== 'link')).toBe(true);
            expect(textOf(nodes)).toContain('Click me');
        });

        it('refuses a data: href', () => {
            const nodes = inline('[Click me](data:text/html;base64,PHNjcmlwdD4=)');
            expect(nodes.every((node) => node.type !== 'link')).toBe(true);
        });

        it('refuses a javascript: autolink', () => {
            // eslint-disable-next-line no-script-url -- the vector under test
            expect(inline('<javascript:alert(1)>').every((node) => node.type !== 'link')).toBe(
                true,
            );
        });

        it('allows only http and https through', () => {
            expect(inline('[a](https://example.com)')[0].type).toBe('link');
            expect(inline('[a](http://example.com)')[0].type).toBe('link');
            expect(inline('[a](vbscript:msgbox)')[0].type).not.toBe('link');
            expect(inline('[a](/relative/path)')[0].type).not.toBe('link');
        });

        it('terminates on input designed to confuse it', () => {
            expect(() => parseMarkdownSubset('**'.repeat(500))).not.toThrow();
            expect(() => parseMarkdownSubset('[a]('.repeat(500))).not.toThrow();
            expect(() => parseMarkdownSubset('<u>'.repeat(500))).not.toThrow();
        });
    });
});
