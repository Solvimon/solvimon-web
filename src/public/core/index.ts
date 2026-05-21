/**
 * Solvimon Core – define and mount components/screens in a container
 *
 * Use createSolvimonCore to configure shared settings once and mount screens or components
 * into your own container without using web components directly.
 */

export { createSolvimonCore } from './configuration';
export { getRegisteredScreenIds, getRegisteredComponentIds } from './registry';
export type {
    CoreConfiguration,
    ComponentConfigurationById,
    ScreenConfigurationById,
    ComponentMountConfiguration,
    ScreenMountConfiguration,
    SolvimonMountConfig,
    SolvimonMountInstance,
    RegisteredScreenId,
    RegisteredComponentId,
} from './types';
export type { ActionRequestDetail, RequestActionEvent } from './action-request.types';
export type {
    LogEntry,
    LogLevel,
    LogSink,
    ErrorCode,
} from '@/components/providers/LoggerProvider/LoggerProvider.types';
