import type { Invoice } from '@solvimon/solvimon-types';

export interface SubscriptionManagementSummaryProps {
    /** What the change would be invoiced for. Absent until the first preview comes back. */
    invoice?: Invoice;
    isPending?: boolean;
    hasError?: boolean;
    /** The plan the subscription runs on once the change is committed. */
    planName?: string;
    avatar?: string;
}
