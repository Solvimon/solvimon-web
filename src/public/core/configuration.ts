import { ensureCustomElementDefined } from './registry.ce';
import type {
    CoreConfiguration,
    RegisteredComponentId,
    RegisteredScreenId,
    SolvimonMountConfig,
    SolvimonMountInstance,
} from './types';
import type { SolvimonEventListeners } from './events.types';
import type { LogSink } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { getSessionReference } from '@/utils/sessionReference';

type ElementProps = Record<string, unknown>;

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

function setElementProps(element: HTMLElement, props: ElementProps): void {
    const definedProps: ElementProps = {};

    for (const [key, value] of Object.entries(props)) {
        if (value === undefined) continue;
        definedProps[key] = value;
    }

    Object.assign(element, definedProps);
}

/**
 * Reports a failed entry load. A host that passed `onLog` gets it through the sink it already
 * reads; without one the rejection is left to surface, because swallowing it would leave an empty
 * container and no way to find out why.
 */
function reportLoadFailure(
    id: string,
    type: 'component' | 'screen',
    error: unknown,
    onLog?: LogSink,
): void {
    if (!onLog) throw error;

    onLog({
        schemaVersion: 1,
        level: 'error',
        code: 'INITIAL_DATA_LOAD_FAILED',
        message: `Solvimon: failed to load the "${id}" ${type}`,
        timestamp: new Date().toISOString(),
        // The same reference the logger inside the tree uses, so a load failure and whatever the
        // customer did next are one session rather than two unconnected reports.
        reference: getSessionReference(),
        context: { id, type },
        error,
    });
}

function mountSolvimonElement(
    container: Element | string,
    id: RegisteredComponentId | RegisteredScreenId,
    type: 'component' | 'screen',
    props: ElementProps,
    on: SolvimonEventListeners = {},
    onLog?: LogSink,
): SolvimonMountInstance {
    // Both resolved before the entry loads, so a bad container or an unknown id still throws at the
    // call site rather than inside a promise the caller never sees.
    const parent = resolveContainer(container);
    const definition = ensureCustomElementDefined(id, type);

    let element: HTMLElement | undefined;
    let unmounted = false;

    // The entry arrives over the network, so the element is appended once it does. `unmount` stays
    // synchronous, and calling it before the entry lands cancels the mount.
    void definition
        .then((tagName) => {
            if (unmounted) return;

            element = document.createElement(tagName);
            setElementProps(element, props);
            // Before the append, so even an event dispatched as the element connects is heard.
            for (const [name, listener] of Object.entries(on)) {
                // `Object.entries` loses which listener belongs to which event; `on` is typed by name.
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                element.addEventListener(name, listener as EventListener);
            }
            parent.appendChild(element);
        })
        .catch((error: unknown) => reportLoadFailure(id, type, error, onLog));

    return {
        unmount() {
            unmounted = true;
            element?.remove();
            element = undefined;
        },
    };
}

export function createSolvimonCore<TConfig extends SolvimonMountConfig>(
    config: TConfig,
): CoreConfiguration<TConfig>;
// A JavaScript host can still leave the configuration out. Its element then reports the missing
// environment, as an element does, rather than this throwing on `undefined`.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export function createSolvimonCore(config = {} as SolvimonMountConfig): CoreConfiguration {
    const mount =
        (type: 'component' | 'screen') =>
        (
            id: RegisteredComponentId | RegisteredScreenId,
            {
                container,
                on,
                ...props
            }: { container: Element | string; on?: SolvimonEventListeners },
        ) =>
            mountSolvimonElement(container, id, type, { ...config, ...props }, on, config.onLog);

    return { config, createComponent: mount('component'), createScreen: mount('screen') };
}
