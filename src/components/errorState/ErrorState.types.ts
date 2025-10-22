export interface ErrorStateProps {
    title: string;
    subtitle?: string;
    showRetry?: boolean;
    withSpacing?: boolean;
}

export interface ErrorStateEmits {
    (e: 'retry'): void;
}
