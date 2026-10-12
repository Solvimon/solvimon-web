export type RichTextPart = { text: string; strong: boolean };

type StrongChunk = { strong: string };

const isStrongChunk = (value: unknown): value is StrongChunk =>
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'strong') === 'string';

/**
 * The `<strong>` handler for `$t`. It returns a marker rather than markup, so the message comes
 * back as parts the template renders as text and the values in it are never parsed as HTML.
 */
export const strong = (chunks: unknown[]): StrongChunk => ({
    strong: chunks.filter((chunk): chunk is string => typeof chunk === 'string').join(''),
});

/** A message formatted with `strong`, as text parts. A message without a tag is one part. */
export function toRichTextParts(message: unknown): RichTextPart[] {
    const parts: unknown[] = Array.isArray(message) ? message : [message];

    return parts.flatMap((part): RichTextPart[] => {
        if (typeof part === 'string') return part ? [{ text: part, strong: false }] : [];
        if (isStrongChunk(part)) return [{ text: part.strong, strong: true }];
        return [];
    });
}
