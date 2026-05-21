import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useBreakpoints } from './useBreakpoints';

const mockMatchMedia = () => {
    const mql = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
    return mql;
};

const mountAndCall = (call: (bp: ReturnType<typeof useBreakpoints>) => void) => {
    mount(
        defineComponent({
            setup() {
                call(useBreakpoints());
            },
            render: () => h('div'),
        }),
    );
};

describe('useBreakpoints', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('smaller', () => {
        it.each([
            ['sm', 639],
            ['md', 767],
            ['lg', 1023],
            ['xl', 1279],
            ['2xl', 1535],
        ] as const)('%s uses max-width: %spx', (bp, expected) => {
            mockMatchMedia();
            mountAndCall((breakpoints) => breakpoints.smaller(bp));
            expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: ${expected}px)`);
        });
    });

    describe('smallerOrEqual', () => {
        it.each([
            ['sm', 640],
            ['md', 768],
            ['lg', 1024],
            ['xl', 1280],
            ['2xl', 1536],
        ] as const)('%s uses max-width: %spx', (bp, expected) => {
            mockMatchMedia();
            mountAndCall((breakpoints) => breakpoints.smallerOrEqual(bp));
            expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: ${expected}px)`);
        });
    });

    describe('greaterOrEqual', () => {
        it.each([
            ['sm', 640],
            ['md', 768],
            ['lg', 1024],
            ['xl', 1280],
            ['2xl', 1536],
        ] as const)('%s uses min-width: %spx', (bp, expected) => {
            mockMatchMedia();
            mountAndCall((breakpoints) => breakpoints.greaterOrEqual(bp));
            expect(window.matchMedia).toHaveBeenCalledWith(`(min-width: ${expected}px)`);
        });
    });
});
