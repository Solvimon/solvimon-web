import type { EntryBaseProps } from '@/types/EntryBaseProps';

/**
 * Shared configuration passed to all mounted Solvimon components and screens.
 * Extends the base entry props (environment, token, locale, branding, etc.).
 */
export type SolvimonMountConfig = EntryBaseProps;

/**
 * View that renders a full screen (e.g. Customer Overview, Checkout).
 */
export interface ScreenView {
    type: 'screen';
    /** Screen id; use one of the registered screen ids (e.g. 'customer-overview', 'checkout'). */
    id: string;
    /** Optional props specific to this screen (callbacks, overrides). */
    props?: Record<string, unknown>;
}

/**
 * View that renders a single component (e.g. Invoices List, Payment Methods).
 */
export interface ComponentView {
    type: 'component';
    /** Component id; use one of the registered component ids. */
    id: string;
    /** Optional props specific to this component. */
    props?: Record<string, unknown>;
}

/**
 * Describes what to render in the container: either a screen or a component.
 */
export type ViewConfig = ScreenView | ComponentView;

/**
 * Options for mounting Solvimon into a consumer-provided container.
 */
export interface MountOptions {
    /**
     * The container to mount into. Can be a CSS selector string or an Element.
     */
    container: Element | string;
    /**
     * Shared configuration (environment, token, locale, branding, etc.).
     */
    config: SolvimonMountConfig;
    /**
     * Which screen or component to render and its optional props.
     */
    view: ViewConfig;
}

/**
 * Return type of createSolvimonMount. Exposes unmount and optional app instance.
 */
export interface SolvimonMountInstance {
    /** Unmounts the Solvimon app from the container. */
    unmount: () => void;
}

/**
 * Registered screen ids that can be used in ViewConfig.
 */
export type RegisteredScreenId = 'customer-overview' | 'checkout';

/**
 * Registered component ids that can be used in ViewConfig.
 */
export type RegisteredComponentId =
    | 'invoices-list'
    | 'subscriptions-list'
    | 'customer-payment-methods'
    | 'billing-information';
