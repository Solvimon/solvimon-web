import type { MountOptions, SolvimonMountInstance } from './types';
import { getCustomElementTagName, ensureCustomElementDefined } from './registry.ce';

function resolveContainer(container: Element | string): Element {
    if (typeof container === 'string') {
        const el = document.querySelector(container);
        if (!el) {
            throw new Error(`Solvimon: container not found for selector "${container}"`);
        }
        return el;
    }
    return container;
}

function setElementProps(element: HTMLElement, props: Record<string, unknown>): void {
    const el = element as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined) continue;
        el[key] = value;
    }
}

/**
 * Mounts a Solvimon screen or component as a custom element into the given container.
 * The consumer provides the container (element or selector), shared config, and which view to render.
 * The custom element is registered if needed, then created and appended to the container with props set as element properties.
 *
 * @example
 * ```ts
 * import { createSolvimonMount } from '@solvimon/sdk/core';
 *
 * const { unmount } = createSolvimonMount({
 *   container: '#solvimon-app',
 *   config: {
 *     environment: 'sandbox',
 *     token: 'your-token',
 *     locale: 'en-US',
 *   },
 *   view: {
 *     type: 'screen',
 *     id: 'customer-overview',
 *     props: {
 *       onViewInvoice: (payload) => console.log('View invoice', payload),
 *     },
 *   },
 * });
 *
 * // Later: unmount();
 * ```
 */
export function createSolvimonMount(options: MountOptions): SolvimonMountInstance {
    const { container, config, view } = options;
    const parent = resolveContainer(container);
    const props = { ...config, ...view.props } as Record<string, unknown>;

    ensureCustomElementDefined(view.id, view.type);
    const tagName = getCustomElementTagName(view.id);
    const element = document.createElement(tagName) as HTMLElement;
    setElementProps(element, props);
    parent.appendChild(element);

    return {
        unmount() {
            element.remove();
        },
    };
}
