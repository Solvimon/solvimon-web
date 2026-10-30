/**
 * Cutting solvimon-ui's icon sprite down to the icons the SDK can render.
 *
 * `IconSpriteProvider` fetches the whole sprite, a URL-encoded SVG data URL, on every mount. Each
 * `Icon` refers to a symbol by its `icon` name, and every name in the SDK's code is written out
 * in full, so a symbol whose id appears nowhere else in the bundle can never be shown.
 */

/** The module that exports the sprite, matched without the package name so a linked ui counts too. */
export const ICON_SPRITE_MODULE = /\/dist\/\.icons\/icon-sprite\.svg\.es\.js$/;

const DATA_URL = /"(data:image\/svg\+xml,[^"]*)"/;
const SYMBOL = /%3csymbol(?:(?!%3csymbol).)*?%3c\/symbol%3e/g;
const SYMBOL_ID = /%20id='([\w-]+)'/;

/**
 * Whether `name` appears in `code` as a whole word, so as a string, an object key or a property
 * alike. Matching more than string literals only keeps an icon that turns out to be unused.
 *
 * @param {string} code
 * @param {string} name
 */
const mentions = (code, name) =>
    new RegExp(`(?:^|[^\\w-])${name.replace(/-/g, '\\-')}(?![\\w-])`).test(code);

/**
 * `spriteCode` with its sprite cut down to the symbols whose id `otherCode` mentions, or `null`
 * when `spriteCode` holds no sprite this can read, so that the caller keeps it whole.
 *
 * @param {string} spriteCode - the code that holds the sprite's data URL
 * @param {string} otherCode - every other module's code
 * @returns {{ code: string, kept: string[], dropped: string[] } | null}
 */
export function subsetIconSprite(spriteCode, otherCode) {
    const dataUrl = DATA_URL.exec(spriteCode)?.[1];
    const symbols = dataUrl?.match(SYMBOL);
    if (!dataUrl || !symbols) return null;

    const kept = [];
    const dropped = [];
    const keptSymbols = symbols.filter((symbol) => {
        const id = SYMBOL_ID.exec(symbol)?.[1];
        // A symbol without a readable id is kept: nothing says it is unused.
        const isUsed = !id || mentions(otherCode, id);
        if (id) (isUsed ? kept : dropped).push(id);
        return isUsed;
    });

    const start = dataUrl.indexOf(symbols[0]);
    const end =
        dataUrl.lastIndexOf(symbols[symbols.length - 1]) + symbols[symbols.length - 1].length;
    const subset = dataUrl.slice(0, start) + keptSymbols.join('') + dataUrl.slice(end);

    return { code: spriteCode.replace(dataUrl, () => subset), kept, dropped };
}
