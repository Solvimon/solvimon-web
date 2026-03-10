/**
 * Solvimon Core – define and mount components/screens in a container
 *
 * Use createSolvimonMount to render a screen or component without using web components directly.
 * You provide the container (element or selector), shared config, and which view to show.
 */

export { createSolvimonMount } from './mount';
export { getRegisteredScreenIds, getRegisteredComponentIds } from './registry';
export type {
    SolvimonMountConfig,
    ScreenView,
    ComponentView,
    ViewConfig,
    MountOptions,
    SolvimonMountInstance,
    RegisteredScreenId,
    RegisteredComponentId,
} from './types';
export type { ActionRequestDetail, RequestActionEvent } from './action-request.types';
