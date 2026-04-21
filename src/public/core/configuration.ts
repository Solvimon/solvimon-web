import { getCustomElementTagName, ensureCustomElementDefined } from './registry.ce';
import type {
    ComponentMountConfiguration,
    CoreConfiguration,
    RegisteredComponentId,
    RegisteredScreenId,
    ScreenMountConfiguration,
    SolvimonMountConfig,
} from './types';

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

function mountSolvimonElement(
    container: Element | string,
    id: RegisteredComponentId | RegisteredScreenId,
    type: 'component' | 'screen',
    props: Record<string, unknown>,
) {
    const parent = resolveContainer(container);

    ensureCustomElementDefined(id, type);
    const tagName = getCustomElementTagName(id);
    const element = document.createElement(tagName) as HTMLElement;

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
    return { container, props };
}

export function createSolvimonCore<
    TConfig extends SolvimonMountConfig = SolvimonMountConfig,
>(config = {} as TConfig): CoreConfiguration<TConfig> {
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
                { ...config, ...props } as Record<string, unknown>,
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
                { ...config, ...props } as Record<string, unknown>,
            ).unmount;
        },
    };
}
