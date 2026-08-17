import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SlidingPanes from './SlidingPanes.vue';

const PANES = ['FIRST', 'SECOND', 'THIRD'];

const mountPanes = (current = 'FIRST') =>
    mount(SlidingPanes, {
        props: { panes: PANES, current },
        slots: {
            FIRST: '<p>first pane</p>',
            SECOND: '<p>second pane</p>',
            THIRD: '<p>third pane</p>',
        },
        attachTo: document.body,
    });

type Wrapper = ReturnType<typeof mountPanes>;

const viewport = (wrapper: Wrapper) => wrapper.find('.sv-sliding-panes__viewport');

/**
 * How far the track has slid, which is what says which pane is on screen. A step is a pane's width
 * plus the gap that keeps the neighbouring pane out of the viewport's sideways clip.
 */
const trackOffset = (wrapper: Wrapper) =>
    wrapper.find<HTMLElement>('.sv-sliding-panes__track').element.style.transform;

const atPane = (index: number) =>
    index === 0 ? 'translateX(0px)' : `translateX(calc(${-index} * (100% + 1rem)))`;

const panes = (wrapper: Wrapper) => wrapper.findAll('.sv-sliding-panes__pane');

/**
 * jsdom has no layout engine, so `offsetHeight` is always 0 unless it is stubbed. The measured
 * element is the one inside the pane, not the pane itself.
 */
const stubPaneHeight = (wrapper: Wrapper, index: number, height: number) => {
    const measured = panes(wrapper)[index]?.element.firstElementChild;

    Object.defineProperty(measured, 'offsetHeight', { configurable: true, value: height });
};

const showPane = async (wrapper: Wrapper, pane: string) => {
    await wrapper.setProps({ current: pane });
    await nextTick();
};

describe('SlidingPanes', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('lays out a pane per entry and fills each from its own slot', () => {
        const wrapper = mountPanes();

        expect(panes(wrapper)).toHaveLength(3);
        expect(panes(wrapper).map((pane) => pane.text())).toEqual([
            'first pane',
            'second pane',
            'third pane',
        ]);
    });

    it('leaves the track at rest on the first pane', () => {
        expect(trackOffset(mountPanes())).toBe(atPane(0));
    });

    it('slides the track over to the pane on screen, gaps included', async () => {
        const wrapper = mountPanes();

        await showPane(wrapper, 'THIRD');

        expect(trackOffset(wrapper)).toBe(atPane(2));
    });

    it('leaves the track where it is for a pane it was never given', async () => {
        const wrapper = mountPanes();

        await showPane(wrapper, 'FOURTH');

        expect(trackOffset(wrapper)).toBe(atPane(0));
    });

    /** Off-screen panes stay mounted, so they have to be kept out of the tab order by hand. */
    it('makes every pane but the one on screen inert', async () => {
        const wrapper = mountPanes();
        expect(panes(wrapper).map((pane) => pane.attributes('inert'))).toEqual([
            undefined,
            'true',
            'true',
        ]);

        await showPane(wrapper, 'SECOND');

        expect(panes(wrapper).map((pane) => pane.attributes('inert'))).toEqual([
            'true',
            undefined,
            'true',
        ]);
    });

    it('sizes the viewport to the pane on screen', async () => {
        const wrapper = mountPanes();
        stubPaneHeight(wrapper, 1, 240);

        await showPane(wrapper, 'SECOND');

        expect(viewport(wrapper).attributes('style')).toContain('height: 240px');
    });

    it('animates the viewport height while the panes slide past each other', async () => {
        const wrapper = mountPanes();

        await showPane(wrapper, 'SECOND');

        expect(viewport(wrapper).classes()).toContain('transition-[height]');
    });

    it('stops animating the viewport height once the panes have settled', async () => {
        const wrapper = mountPanes();
        await showPane(wrapper, 'SECOND');

        await vi.advanceTimersByTimeAsync(300);

        // Regression: content that animates itself — an input expanding — re-measured the pane every
        // frame and restarted this ease, so the height crawled behind and clipped what it revealed.
        expect(viewport(wrapper).classes()).not.toContain('transition-[height]');
    });

    it('leaves the viewport height unanimated until a pane is ever switched', () => {
        expect(viewport(mountPanes()).classes()).not.toContain('transition-[height]');
    });
});
