import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

/**
 * Tracks the rendered height, in pixels, of the element held in `target`.
 *
 * Needed to animate a container between the heights of two children: a transition cannot run to
 * `auto`, so the height has to be measured and applied as a number — and re-measured as the child's
 * own content grows or shrinks.
 */
export function useElementHeight(target: Ref<HTMLElement | undefined>): Ref<number> {
    const height = ref(0);

    const measure = (element: HTMLElement | undefined) => {
        height.value = element?.offsetHeight ?? 0;
    };

    // `ResizeObserver` is unavailable in jsdom and in older browsers. Without it the height is still
    // measured once per target change, it just stops following later resizes.
    const observer =
        typeof ResizeObserver === 'undefined'
            ? undefined
            : new ResizeObserver((entries) => {
                  const element = entries[0]?.target;
                  measure(element instanceof HTMLElement ? element : undefined);
              });

    watch(
        target,
        (element, previousElement) => {
            if (previousElement) {
                observer?.unobserve(previousElement);
            }

            measure(element);

            if (element) {
                observer?.observe(element);
            }
        },
        // `post` so the callback runs after the render that assigns the template ref, not before.
        { immediate: true, flush: 'post' },
    );

    onBeforeUnmount(() => {
        observer?.disconnect();
    });

    return height;
}
