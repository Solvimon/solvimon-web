<script setup lang="ts">
/**
 * Panes laid side by side on a track that slides the chosen one into view, in a viewport that
 * animates between their heights.
 *
 * Every pane stays mounted and keeps its inputs and whatever it has already loaded, so stepping back
 * and forth is free. The ones off screen are `inert`, which keeps them out of the tab order and away
 * from screen readers.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SlidingPanesProps } from './SlidingPanes.types';
import { useElementHeight } from '@/composables/useElementHeight';

const props = defineProps<SlidingPanesProps>();

/** How long the panes take to slide past each other, matching the `duration-300` on the track. */
const PANE_TRANSITION_MS = 300;

/**
 * The space between panes on the track, matching the `gap-4` that puts it there.
 *
 * It exists so the viewport's sideways clip has something empty to cut: the clip box reaches past the
 * panes by the viewport's own padding — the room a selected option's ring needs — and without a gap
 * that same room shows the edge of the neighbouring pane. Twice the padding leaves the neighbour just
 * out of sight.
 */
const PANE_GAP = '1rem';

/**
 * Whether the panes are sliding past each other right now — the only time the viewport animates its
 * own height.
 *
 * Animating it the rest of the time fights whatever is growing inside: content that expands over its
 * own 300ms re-measures the pane every frame, restarting this ease from wherever it had got to. The
 * height then crawls behind its target, clipping the content it is supposed to be revealing, and keeps
 * easing after the inner animation has finished. Outside a switch the measured height is applied
 * straight away instead, so the inner animation is what the user sees.
 */
const isSwitchingPanes = ref(false);
let switchTimeout: ReturnType<typeof setTimeout> | undefined;

watch(
    () => props.current,
    () => {
        isSwitchingPanes.value = true;
        clearTimeout(switchTimeout);
        switchTimeout = setTimeout(() => {
            isSwitchingPanes.value = false;
        }, PANE_TRANSITION_MS);
    },
);

onBeforeUnmount(() => {
    clearTimeout(switchTimeout);
});

const paneElements = ref<Record<string, HTMLElement | undefined>>({});

const paneRefSetters: Record<string, (element: unknown) => void> = {};

/**
 * One setter per pane, remembered rather than built per render: handed a fresh function, Vue drops
 * the element and sets it again on every patch.
 */
const setPaneElement = (pane: string) =>
    (paneRefSetters[pane] ??= (element: unknown) => {
        paneElements.value[pane] = element instanceof HTMLElement ? element : undefined;
    });

/**
 * Only the pane on screen is measured: it is the one the viewport is sized to, and the others are
 * free to change height off screen without dragging it around.
 */
const currentPaneElement = computed(() => paneElements.value[props.current]);

/**
 * The height the viewport animates to. A transition cannot run to `auto`, so it tracks whichever pane
 * is on screen — and follows that pane as its own content changes.
 */
const paneHeight = useElementHeight(currentPaneElement);

/** How far the track has to slide to bring the current pane into view, gaps included. */
const trackOffset = computed(() => {
    const index = props.panes.indexOf(props.current);

    return index > 0 ? `translateX(calc(${-index} * (100% + ${PANE_GAP})))` : 'translateX(0px)';
});
</script>

<template>
    <!--
        The negative margin and the matching padding give a focused control's ring room to sit outside
        its pane without the sideways clip cutting it off.
    -->
    <div
        class="sv-sliding-panes__viewport relative -mx-2 overflow-hidden px-2"
        :class="
            isSwitchingPanes
                ? 'transition-[height] duration-300 ease-in-out motion-reduce:transition-none'
                : ''
        "
        :style="paneHeight ? { height: `${paneHeight}px` } : undefined"
    >
        <div
            class="sv-sliding-panes__track flex items-start gap-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none"
            :style="{ transform: trackOffset }"
        >
            <div
                v-for="pane in panes"
                :key="pane"
                class="sv-sliding-panes__pane w-full shrink-0"
                :inert="pane !== current || undefined"
            >
                <!--
                    The inner element is what gets measured, so the height read back is the content's
                    own rather than anything the track's layout puts on the pane around it.
                -->
                <div :ref="setPaneElement(pane)">
                    <slot :name="pane" />
                </div>
            </div>
        </div>
    </div>
</template>
