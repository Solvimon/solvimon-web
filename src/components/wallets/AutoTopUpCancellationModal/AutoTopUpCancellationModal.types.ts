import type { WalletAutoTopUpConfig } from '@solvimon/solvimon-types';

export interface AutoTopUpCancellationModalProps {
    showModal: boolean;
    config?: WalletAutoTopUpConfig;
}

export interface AutoTopUpCancellationModalEmits {
    (e: 'confirmed'): void;
    (e: 'close'): void;
}
