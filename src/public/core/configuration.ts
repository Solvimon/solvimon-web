import { getCustomElementTagName, ensureCustomElementDefined } from './registry.ce';
import type {
    ComponentMountConfiguration,
    CoreConfiguration,
    RegisteredComponentId,
    RegisteredScreenId,
    ScreenMountConfiguration,
    SolvimonMountConfig,
} from './types';

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

function mountSolvimonElement(
    container: Element | string,
    id: RegisteredComponentId | RegisteredScreenId,
    type: 'component' | 'screen',
    props: ElementProps,
) {
    const parent = resolveContainer(container);

    ensureCustomElementDefined(id, type);
    const tagName = getCustomElementTagName(id);
    const element = document.createElement(tagName);

    setElementProps(element, props);
    parent.appendChild(element);

    return {
        unmount() {
            element.remove();
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
            ).unmount;
        },
        createScreen<TId extends RegisteredScreenId>(
            id: TId,
            configuration: ScreenMountConfiguration<TId>,
        ) {
            const { container, props } = splitContainer(configuration);

            return mountSolvimonElement(container, id, 'screen', mergeElementProps(config, props))
                .unmount;
        },
    };
}
