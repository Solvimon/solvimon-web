import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useElementHeight } from './useElementHeight';

// ─── ResizeObserver stub ──────────────────────────────────────────────────────

type ResizeCallback = (entries: { target: Element }[]) => void;

const observed = new Set<Element>();
let capturedCallback: ResizeCallback | undefined;
const disconnect = vi.fn(() => observed.clear());

class ResizeObserverStub {
    constructor(callback: ResizeCallback) {
        capturedCallback = callback;
    }
    observe = (element: Element) => observed.add(element);
    unobserve = (element: Element) => observed.delete(element);
    disconnect = disconnect;
}

/**
 * Mounts a component that measures an element rendered only while `show` is true, so the composable
 * is exercised through a real template ref rather than a hand-made one.
 */
const mountComponent = async ({ height = 180 }: { height?: number } = {}) => {
    const show = ref(true);
    const target = ref<HTMLElement>();
    let measured!: ReturnType<typeof useElementHeight>;

    const wrapper = mount(
        defineComponent({
            setup() {
                measured = useElementHeight(target);
                return () => (show.value ? h('div', { ref: target }) : null);
            },
        }),
        { attachTo: document.body },
    );

    // jsdom has no layout engine, so `offsetHeight` is always 0 unless it is stubbed. This has to
    // happen before the post-flush watcher takes its first measurement.
    if (target.value) {
        Object.defineProperty(target.value, 'offsetHeight', { configurable: true, value: height });
    }
    await nextTick();

    return { wrapper, show, target, measured: () => measured };
};

describe('useElementHeight', () => {
    beforeEach(() => {
        observed.clear();
        capturedCallback = undefined;
        disconnect.mockClear();
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('starts at zero while there is no target', () => {
        const target = ref<HTMLElement>();
        let measured!: ReturnType<typeof useElementHeight>;

        mount(
            defineComponent({
                setup() {
                    measured = useElementHeight(target);
                    return () => null;
                },
            }),
        );

        expect(measured.value).toBe(0);
    });

    it('measures and observes the target once it is mounted', async () => {
        const { target, measured } = await mountComponent({ height: 180 });

        expect(measured().value).toBe(180);
        expect(observed.has(target.value!)).toBe(true);
    });

    it('re-measures when the observer reports a resize', async () => {
        const { target, measured } = await mountComponent({ height: 180 });

        Object.defineProperty(target.value!, 'offsetHeight', { configurable: true, value: 320 });
        capturedCallback!([{ target: target.value! }]);
        await nextTick();

        expect(measured().value).toBe(320);
    });

    it('stops observing and resets to zero when the target goes away', async () => {
        const { show, target, measured } = await mountComponent();
        const element = target.value!;

        show.value = false;
        await nextTick();

        expect(observed.has(element)).toBe(false);
        expect(measured().value).toBe(0);
    });

    it('disconnects the observer when the component unmounts', async () => {
        const { wrapper } = await mountComponent();

        wrapper.unmount();

        expect(disconnect).toHaveBeenCalled();
    });

    it('still measures once when ResizeObserver is unavailable', async () => {
        vi.stubGlobal('ResizeObserver', undefined);

        const { measured } = await mountComponent({ height: 180 });

        expect(measured().value).toBe(180);
    });
});
