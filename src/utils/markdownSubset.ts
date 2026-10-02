import { sanitizeUrl } from '@/utils/url';

/**
 * The only markdown the checkout note supports: text, bold, italic, underline and links.
 *
 * Deliberately a node tree rather than an HTML string. The note is written by a merchant in Desk
 * and shown to their customers, so rendering it through `v-html` would be stored XSS on the
 * checkout page. Nothing here produces markup — the renderer walks these nodes with real
 * components, and anything the parser does not recognise stays text.
 */
export type MarkdownInlineNode =
    | { type: 'text'; value: string }
    | { type: 'break' }
    | { type: 'bold'; children: MarkdownInlineNode[] }
    | { type: 'italic'; children: MarkdownInlineNode[] }
    | { type: 'underline'; children: MarkdownInlineNode[] }
    | { type: 'link'; href: string; children: MarkdownInlineNode[] };

export type MarkdownParagraph = { type: 'paragraph'; children: MarkdownInlineNode[] };

/** Underline has no markdown syntax, so the editor round-trips it as a `<u>` tag. */
const UNDERLINE = /^<u>([\s\S]*?)<\/u>/i;
const BOLD = /^\*\*([\s\S]+?)\*\*/;
const ITALIC_STAR = /^\*([\s\S]+?)\*/;
const ITALIC_UNDERSCORE = /^_([\s\S]+?)_/;
const LINK = /^\[([^\]]*)\]\(\s*([^)\s]*)\s*\)/;
/** A link whose text is its own href serializes as a CommonMark autolink. */
const AUTOLINK = /^<([a-z][a-z0-9+.-]*:[^>\s]+)>/i;

const PARAGRAPH_BREAK = /\n[ \t]*\n/;

function parseInline(source: string): MarkdownInlineNode[] {
    const nodes: MarkdownInlineNode[] = [];
    let text = '';

    const flush = () => {
        if (text) {
            nodes.push({ type: 'text', value: text });
            text = '';
        }
    };

    let index = 0;
    while (index < source.length) {
        const rest = source.slice(index);

        const bold = BOLD.exec(rest);
        if (bold) {
            flush();
            nodes.push({ type: 'bold', children: parseInline(bold[1]) });
            index += bold[0].length;
            continue;
        }

        const italic = ITALIC_STAR.exec(rest) ?? ITALIC_UNDERSCORE.exec(rest);
        if (italic) {
            flush();
            nodes.push({ type: 'italic', children: parseInline(italic[1]) });
            index += italic[0].length;
            continue;
        }

        const underline = UNDERLINE.exec(rest);
        if (underline) {
            flush();
            nodes.push({ type: 'underline', children: parseInline(underline[1]) });
            index += underline[0].length;
            continue;
        }

        const link = LINK.exec(rest);
        if (link) {
            flush();
            nodes.push(toLink(link[2], parseInline(link[1])));
            index += link[0].length;
            continue;
        }

        const autolink = AUTOLINK.exec(rest);
        if (autolink) {
            flush();
            nodes.push(toLink(autolink[1], [{ type: 'text', value: autolink[1] }]));
            index += autolink[0].length;
            continue;
        }

        if (source[index] === '\n') {
            flush();
            nodes.push({ type: 'break' });
            index += 1;
            continue;
        }

        text += source[index];
        index += 1;
    }

    flush();
    return nodes;
}

/**
 * A link only stays a link while its href is one the browser may follow. `javascript:` and `data:`
 * hrefs fall back to their own text, so the words survive and the payload does not.
 */
function toLink(href: string, children: MarkdownInlineNode[]): MarkdownInlineNode {
    const safeHref = sanitizeUrl(href);
    return safeHref
        ? { type: 'link', href: safeHref, children }
        : { type: 'text', value: textOf(children) };
}

function textOf(nodes: MarkdownInlineNode[]): string {
    return nodes
        .map((node) => {
            if (node.type === 'text') return node.value;
            if (node.type === 'break') return ' ';
            return textOf(node.children);
        })
        .join('');
}

export function parseMarkdownSubset(source: string | undefined | null): MarkdownParagraph[] {
    if (!source?.trim()) return [];

    return source
        .split(PARAGRAPH_BREAK)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => ({ type: 'paragraph' as const, children: parseInline(block) }));
}
