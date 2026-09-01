import { getCustomElementTagName, ensureCustomElementDefined } from './registry.ce';
import type {
    ComponentMountConfiguration,
    CoreConfiguration,
    RegisteredComponentId,
    RegisteredScreenId,
    ScreenMountConfiguration,
    SolvimonMountConfig,
} from './types';
import type { LogSink } from '@/components/providers/LoggerProvider/LoggerProvider.types';

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
        context: { id, type },
        error,
    });
}

function mountSolvimonElement(
    container: Element | string,
    id: RegisteredComponentId | RegisteredScreenId,
    type: 'component' | 'screen',
    props: ElementProps,
    onLog?: LogSink,
) {
    // Both resolved before the entry loads, so a bad container or an unknown id still throws at the
    // call site rather than inside a promise the caller never sees.
    const parent = resolveContainer(container);
    const tagName = getCustomElementTagName(id);
    const definition = ensureCustomElementDefined(id, type);

    let element: HTMLElement | undefined;
    let unmounted = false;

    // The entry arrives over the network, so the element is appended once it does. `unmount` stays
    // synchronous, and calling it before the entry lands cancels the mount.
    void definition
        .then(() => {
            if (unmounted) return;

            element = document.createElement(tagName);
            setElementProps(element, props);
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

function splitContainer<TConfiguration extends { container: Element | string }>(
    configuration: TConfiguration,
) {
    const { container, ...props } = configuration;
    return { container, props: Object.fromEntries(Object.entries(props)) };
}

function mergeElementProps(
    config: SolvimonMountConfig,
    props: Record<string, unknown>,
): ElementProps {
    return {
        ...config,
        ...props,
    };
}

export function createSolvimonCore(): CoreConfiguration<SolvimonMountConfig>;
export function createSolvimonCore<TConfig extends SolvimonMountConfig>(
    config: TConfig,
): CoreConfiguration<TConfig>;
export function createSolvimonCore(config: SolvimonMountConfig = {}) {
    return {
        config,
        createComponent<TId extends RegisteredComponentId>(
            id: TId,
            configuration: ComponentMountConfiguration<TId>,
        ) {
            const { container, props } = splitContainer(configuration);

            return mountSolvimonElement(
                container,
                id,
                'component',
                mergeElementProps(config, props),
                config.onLog,
            ).unmount;
        },
        createScreen<TId extends RegisteredScreenId>(
            id: TId,
            configuration: ScreenMountConfiguration<TId>,
        ) {
            const { container, props } = splitContainer(configuration);

            return mountSolvimonElement(
                container,
                id,
                'screen',
                mergeElementProps(config, props),
                config.onLog,
            ).unmount;
        },
    };
}
