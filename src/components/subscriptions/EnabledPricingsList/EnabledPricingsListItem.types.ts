import type { EnabledPricingsListEntry } from './EnabledPricingsList.types';

export interface EnabledPricingsListItemProps {
    entry: EnabledPricingsListEntry;
    /** Whether the Upgrade action is offered. */
    canUpgrade?: boolean;
}

export interface EnabledPricingsListItemEmits {
    (e: 'upgrade', entry: EnabledPricingsListEntry): void;
}
