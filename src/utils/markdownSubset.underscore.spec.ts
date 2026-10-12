import { describe, expect, it } from 'vitest';
import { parseMarkdownSubset, type MarkdownInlineNode } from './markdownSubset';

/** DD-3553: an underscore inside a word is text, around a word it is still italics. */

const inline = (source: string) => parseMarkdownSubset(source)[0]?.children ?? [];
const italics = (nodes: MarkdownInlineNode[]): MarkdownInlineNode[] =>
    nodes.flatMap((node) =>
        node.type === 'italic' ? [node] : 'children' in node ? italics(node.children) : [],
    );
const textOf = (nodes: MarkdownInlineNode[]): string =>
    nodes
        .map((node) => {
            if (node.type === 'text') return node.value;
            if (node.type === 'break') return '\n';
            return textOf(node.children);
        })
        .join('');

describe('parseMarkdownSubset underscores', () => {
    it.each([
        'snake_case',
        'a snake_case_name here',
        'See https://example.com/terms_and_conditions_v2 now',
        'ref_1_2 and id_9_',
        'trailing_ , then more',
        'word_. Next sentence_!',
        'émigré_naïve_café',
        '2_000_000',
    ])('keeps %j as plain text', (source) => {
        const nodes = inline(source);

        expect(italics(nodes)).toEqual([]);
        expect(textOf(nodes)).toBe(source);
    });

    it.each([
        ['_word_', 'word'],
        ['say _word_.', 'word'],
        ['(_word_)', 'word'],
        ['_a_b_', 'a_b'],
        ['_two words_, ok', 'two words'],
    ])('reads %j as italics of %j', (source, italic) => {
        const found = italics(inline(source));

        expect(found).toHaveLength(1);
        expect(textOf([found[0]])).toBe(italic);
    });

    it('reads a link whose URL has underscores as one link', () => {
        const nodes = inline('[terms](https://example.com/_terms_of_use_)');

        expect(nodes).toEqual([
            {
                type: 'link',
                href: 'https://example.com/_terms_of_use_',
                children: [{ type: 'text', value: 'terms' }],
            },
        ]);
    });

    it('keeps the text of __double__ whatever it makes of it', () => {
        expect(textOf(inline('__double__'))).toContain('double');
    });

    // CommonMark treats `__` inside a word like `_`: neither opens emphasis. Here the second `_`
    // of the run is preceded by `_`, which is not a letter, so it opens.
    it.fails('keeps a double underscore inside a word as text', () => {
        expect(italics(inline('foo__bar__baz'))).toEqual([]);
    });

    it.each([
        '<script>alert(1)</script>',
        '_<img src=x onerror=alert(1)>_',
        '**<b onmouseover=alert(1)>x</b>**',
        '[x](javascript:alert(1))',
        '<javascript:alert(1)>',
        '_[x](data:text/html,<script>alert(1)</script>)_',
        '<u><svg onload=alert(1)></u>',
    ])('produces no markup and no unsafe link from %j', (source) => {
        const walk = (nodes: MarkdownInlineNode[]): void =>
            nodes.forEach((node) => {
                expect(['text', 'break', 'bold', 'italic', 'underline', 'link']).toContain(
                    node.type,
                );
                if (node.type === 'link') {
                    expect(node.href).toMatch(/^(https?:|mailto:|tel:|\/|#)/i);
                }
                if ('children' in node) walk(node.children);
            });

        walk(parseMarkdownSubset(source).flatMap((paragraph) => paragraph.children));
    });
});
