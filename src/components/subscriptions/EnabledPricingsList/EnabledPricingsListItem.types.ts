import type { EnabledPricingsListEntry } from './EnabledPricingsList.types';

export interface EnabledPricingsListItemProps {
    entry: EnabledPricingsListEntry;
}

export interface EnabledPricingsListItemEmits {
    (e: 'upgrade', entry: EnabledPricingsListEntry): void;
}
