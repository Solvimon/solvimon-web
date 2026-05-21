import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useViewport } from './useViewport';

const createMqlMock = (initialMatches: boolean) => {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    return {
        matches: initialMatches,
        addEventListener: vi.fn((_: string, listener: (e: { matches: boolean }) => void) => {
            listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        trigger: (matches: boolean) => listeners.forEach((l) => l({ matches })),
    };
};

const mountViewport = (initialMatches: boolean) => {
    const mql = createMqlMock(initialMatches);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);

    let isMobileViewport: ReturnType<typeof useViewport>['isMobileViewport'];
    const wrapper = mount(
        defineComponent({
            setup() {
                ({ isMobileViewport } = useViewport());
            },
            render: () => h('div'),
        }),
    );

    return { wrapper, mql, get isMobileViewport() { return isMobileViewport; } };
};

describe('useViewport', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses the sm breakpoint query (max-width: 640px)', () => {
        mountViewport(false);

        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
    });

    it('isMobileViewport is true when the viewport is at or below 640px', () => {
        const { isMobileViewport } = mountViewport(true);

        expect(isMobileViewport.value).toBe(true);
    });

    it('isMobileViewport is false when the viewport is above 640px', () => {
        const { isMobileViewport } = mountViewport(false);

        expect(isMobileViewport.value).toBe(false);
    });

    it('isMobileViewport updates when the viewport changes', async () => {
        const { isMobileViewport, mql } = mountViewport(false);

        mql.trigger(true);
        await nextTick();

        expect(isMobileViewport.value).toBe(true);
    });
});
