import { computed, ref, watch } from 'vue';
import {
    MIN_VIEWPORT_SIZE,
    STORAGE_KEYS,
    clampViewportSize,
    findPreset,
    parseViewportSelection,
    parseViewportSize,
} from './playgroundState';
import type { ViewportSelection, ViewportSize } from './playgroundState';

export type ResizeAxis = 'horizontal' | 'vertical' | 'both';

/**
 * The size the preview is framed at, and the ways of changing it: a named device, the dimensions typed
 * in, or the handles on the frame's edges.
 *
 * Picking a device carries its size over, so typing or dragging afterwards continues from that shape
 * rather than jumping. Doing either then moves off the device onto `responsive`, since the size no
 * longer describes it — the same as devtools behaves.
 */
export function useViewportPreview() {
    const selection = ref<ViewportSelection>(
        parseViewportSelection(sessionStorage.getItem(STORAGE_KEYS.viewport)),
    );
    const customSize = ref<ViewportSize>(
        parseViewportSize(sessionStorage.getItem(STORAGE_KEYS.viewportSize)),
    );

    watch(selection, (value) => sessionStorage.setItem(STORAGE_KEYS.viewport, value));
    watch(customSize, (value) =>
        sessionStorage.setItem(STORAGE_KEYS.viewportSize, JSON.stringify(value)),
    );

    const isFramed = computed(() => selection.value !== 'desktop');

    const size = computed<ViewportSize>(() => findPreset(selection.value) ?? customSize.value);

    function select(value: ViewportSelection) {
        // Carry the size across so the frame keeps its shape when moving onto `responsive`.
        if (value === 'responsive') {
            customSize.value = { ...size.value };
        }

        selection.value = value;
    }

    function resize(next: ViewportSize) {
        customSize.value = clampViewportSize(next);

        // A typed-in or dragged size is no longer the device it started from.
        if (findPreset(selection.value)) {
            selection.value = 'responsive';
        }
    }

    function rotate() {
        resize({ width: size.value.height, height: size.value.width });
    }

    const isResizing = ref(false);

    /**
     * Dragging is tracked on the window rather than the handle, so a pointer that runs ahead of the
     * frame keeps resizing it. The frame stops taking pointer events while this is true, otherwise the
     * iframe swallows them the moment the pointer crosses it.
     */
    function startResize(event: PointerEvent, axis: ResizeAxis) {
        event.preventDefault();

        const origin = { x: event.clientX, y: event.clientY };
        const from = { ...size.value };
        isResizing.value = true;

        const onMove = (moveEvent: PointerEvent) => {
            resize({
                width:
                    axis === 'vertical'
                        ? from.width
                        : Math.max(MIN_VIEWPORT_SIZE, from.width + (moveEvent.clientX - origin.x)),
                height:
                    axis === 'horizontal'
                        ? from.height
                        : Math.max(MIN_VIEWPORT_SIZE, from.height + (moveEvent.clientY - origin.y)),
            });
        };

        const onUp = () => {
            isResizing.value = false;
            window.removeEventListener('pointermove', onMove);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
        window.addEventListener('pointercancel', onUp, { once: true });
    }

    return { selection, size, isFramed, isResizing, select, resize, rotate, startResize };
}
