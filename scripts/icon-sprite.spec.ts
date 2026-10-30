import { describe, it, expect } from 'vitest';
import { ICON_SPRITE_MODULE, subsetIconSprite } from './icon-sprite.mjs';

const symbol = (id: string) =>
    `%3csymbol%20viewBox='0%200%2024%2024'%20id='${id}'%3e%3cpath%20d='M0%200'/%3e%3c/symbol%3e`;
const spriteModule = (...ids: string[]) =>
    `const iconSprite = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%3e${ids
        .map(symbol)
        .join('')}%3c/svg%3e";\nexport { iconSprite as default };`;

describe('subsetIconSprite', () => {
    it('keeps the symbols other code names, and the rest of the sprite around them', () => {
        const result = subsetIconSprite(
            spriteModule('add', 'close', 'west'),
            'h(Icon, { icon: "close" })',
        );

        expect(result?.code).toBe(spriteModule('close'));
        expect(result?.kept).toEqual(['close']);
        expect(result?.dropped).toEqual(['add', 'west']);
    });

    it('counts a name used as an object key or a property as used', () => {
        const result = subsetIconSprite(
            spriteModule('credit_card', 'check_circle', 'west'),
            'const icons={credit_card:1};x.check_circle',
        );

        expect(result?.kept).toEqual(['credit_card', 'check_circle']);
    });

    it('does not count a name that only appears inside a longer one', () => {
        const result = subsetIconSprite(
            spriteModule('check', 'chevron_left'),
            '"check_circle" "chevron_left_double"',
        );

        expect(result?.kept).toEqual([]);
    });

    it('returns null for code without a sprite it can read', () => {
        expect(subsetIconSprite('export default "/icons.svg";', '')).toBeNull();
    });
});

describe('ICON_SPRITE_MODULE', () => {
    it('matches the sprite of an installed and of a linked solvimon-ui', () => {
        expect(
            ICON_SPRITE_MODULE.test(
                '/app/node_modules/@solvimon/solvimon-ui/dist/.icons/icon-sprite.svg.es.js',
            ),
        ).toBe(true);
        expect(
            ICON_SPRITE_MODULE.test('/work/desk/packages/ui/dist/.icons/icon-sprite.svg.es.js'),
        ).toBe(true);
    });
});
