import type { ProviderProps } from '@/components/Provider/Provider.types';

export interface EntryBaseProps extends ProviderProps {
    onError?: () => string;
}
