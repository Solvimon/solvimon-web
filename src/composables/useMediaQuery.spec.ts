import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useMediaQuery } from './useMediaQuery';

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

const mountWithQuery = (query: string, initialMatches: boolean) => {
    const mql = createMqlMock(initialMatches);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);

    let matches: ReturnType<typeof useMediaQuery>;
    const wrapper = mount(
        defineComponent({
            setup() {
                matches = useMediaQuery(query);
            },
            render: () => h('div'),
        }),
    );

    return { wrapper, mql, get matches() { return matches; } };
};

describe('useMediaQuery', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls window.matchMedia with the provided query on mount', () => {
        mountWithQuery('(max-width: 640px)', false);

        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
    });

    it('returns false when the media query does not match', () => {
        const { matches } = mountWithQuery('(max-width: 640px)', false);

        expect(matches.value).toBe(false);
    });

    it('returns true when the media query matches', () => {
        const { matches } = mountWithQuery('(max-width: 640px)', true);

        expect(matches.value).toBe(true);
    });

    it('updates when a change event fires', async () => {
        const { matches, mql } = mountWithQuery('(max-width: 640px)', false);

        mql.trigger(true);
        await nextTick();

        expect(matches.value).toBe(true);
    });

    it('updates back to false when the query stops matching', async () => {
        const { matches, mql } = mountWithQuery('(max-width: 640px)', true);

        mql.trigger(false);
        await nextTick();

        expect(matches.value).toBe(false);
    });

    it('removes the event listener on unmount', () => {
        const { wrapper, mql } = mountWithQuery('(max-width: 640px)', false);

        wrapper.unmount();

        expect(mql.removeEventListener).toHaveBeenCalled();
    });
});
