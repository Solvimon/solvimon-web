/**
 * Parsing the SDK's ICU messages at build time, so that the bundle can leave out the parser.
 *
 * At runtime formatjs parses a message given as a string, and solvimon-ui bundles its parser for
 * that: about 10 kB gzip in the chunk every entry loads. A message given in parsed form, as formatjs's
 * own `compile --ast` writes it, is formatted without one. Every message the SDK and solvimon-ui
 * write is a literal, so all of them can be parsed here: the `defaultMessage` of each message
 * descriptor, and every message of the locale catalogues. A host's own `messages` arrive at
 * runtime, and only those load a parser (`parseHostMessages`).
 *
 * The `description` of a descriptor is only for translators, so it is dropped while at it.
 */
import { parse } from '@formatjs/icu-messageformat-parser';

/** solvimon-ui's bundled parser. Replaced by `PARSER_STUB`, which takes everything only it imports along. */
export const UI_PARSER_MODULE =
    /\/dist\/node_modules\/@formatjs\/icu-messageformat-parser\/lib\/parser\.es\.js$/;

/** A parser that refuses to parse: only parsed messages may reach formatjs in the bundle. */
export const PARSER_STUB = `export class Parser {
    constructor() {
        throw new Error('Messages are parsed at build time; this bundle carries no ICU parser.');
    }
}
`;

/** A locale catalogue, as the SDK and solvimon-ui keep them: JSON, or solvimon-ui's compiled JSON. */
export const CATALOGUE_MODULE =
    /\/translations\/(?:locales\/)?[a-z]{2}-[A-Z]{2}\.json(?:\.es\.js)?$/;

/**
 * `message` in the form formatjs formats without a parser. The options are formatjs's runtime
 * defaults; the locale it also passes only changes `j` in a time skeleton, which no message uses.
 *
 * @param {string} message
 */
export const toAst = (message) => parse(message);

/**
 * A JSON catalogue with every message parsed.
 *
 * @param {string} json
 * @returns {string}
 */
export function precompileCatalogueJson(json) {
    const catalogue = JSON.parse(json);
    return JSON.stringify(
        Object.fromEntries(Object.entries(catalogue).map(([id, message]) => [id, toAst(message)])),
    );
}

/** The text of a string literal or of a template literal without expressions, else `undefined`. */
function staticString(node) {
    if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0].value.cooked;
    }
    return undefined;
}

const keyName = (property) =>
    property.type === 'Property' && !property.computed
        ? (property.key.name ?? property.key.value)
        : undefined;

/** Calls `visit` on every node of an ESTree program. */
function walk(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
        else if (value && typeof value === 'object') walk(value, visit);
    }
}

/** `code` with each `[start, end, text]` edit applied. */
function applyEdits(code, edits) {
    return edits
        .sort((a, b) => b[0] - a[0])
        .reduce(
            (result, [start, end, text]) => result.slice(0, start) + text + result.slice(end),
            code,
        );
}

/**
 * The edits that parse each message descriptor's `defaultMessage` and drop its `description`,
 * for every object in `program` with a literal `defaultMessage`.
 *
 * @param {import('estree').Program} program - `code` parsed, with node offsets
 * @param {string} code
 * @returns {string | null} the new code, or `null` when nothing changed
 */
export function precompileDescriptors(program, code) {
    const edits = [];

    walk(program, (node) => {
        if (node.type !== 'ObjectExpression') return;
        const defaultMessage = node.properties.find((p) => keyName(p) === 'defaultMessage');
        const message = staticString(defaultMessage?.value);
        if (message === undefined) return;

        edits.push([
            defaultMessage.value.start,
            defaultMessage.value.end,
            JSON.stringify(toAst(message)),
        ]);

        const index = node.properties.findIndex((p) => keyName(p) === 'description');
        if (index === -1) return;
        // Up to the next property, or from the previous one when it is the last, so a comma goes too.
        const next = node.properties[index + 1];
        const previous = node.properties[index - 1];
        const description = node.properties[index];
        edits.push(
            next
                ? [description.start, next.start, '']
                : [previous ? previous.end : description.start, description.end, ''],
        );
    });

    return edits.length ? applyEdits(code, edits) : null;
}

/**
 * The edits that parse every message of solvimon-ui's compiled catalogue, a module that binds each
 * message to a constant or to a property of the exported object.
 *
 * @param {import('estree').Program} program
 * @param {string} code
 * @returns {string}
 */
export function precompileCatalogueModule(program, code) {
    const edits = [];

    walk(program, (node) => {
        const value =
            node.type === 'VariableDeclarator'
                ? node.init
                : node.type === 'Property' && !node.shorthand
                  ? node.value
                  : undefined;
        const message = staticString(value);
        if (message !== undefined) {
            edits.push([value.start, value.end, JSON.stringify(toAst(message))]);
        }
    });

    return applyEdits(code, edits);
}

/**
 * The places in `code` where a message is still a string: a descriptor whose `defaultMessage` is a
 * string literal. A build that still has one would hand it to the stubbed parser.
 *
 * @param {string} code
 * @returns {string[]}
 */
export function unparsedDefaultMessages(code) {
    return [...code.matchAll(/defaultMessage\s*:\s*(["'`])((?:\\.|(?!\1).){0,60})/g)].map(
        ([, quote, text]) => `${quote}${text}`,
    );
}
