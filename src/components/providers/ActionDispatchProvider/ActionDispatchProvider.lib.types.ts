import type { ActionRequestDetail } from '@/public/core/action-request.types';

export type { ActionRequestDetail } from '@/public/core/action-request.types';

export type RequestAction = (detail: ActionRequestDetail, originalEvent?: Event) => boolean;
