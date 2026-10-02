import { onBeforeUnmount, ref } from 'vue';
import { useClipboard } from '@solvimon/solvimon-ui';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Copying with a confirmation that fades by itself.
 *
 * `useClipboard` from the UI library hands back the copied value as a snapshot rather than a ref,
 * so a caller watching it would never see it change. The flag is kept here instead, and the timer
 * that clears it is cancelled on unmount so it cannot write to a component that is gone.
 */
export function useCopyToClipboard({ resetAfterMs = COPIED_FEEDBACK_MS } = {}) {
    const [copyToClipboard] = useClipboard();
    const hasCopied = ref(false);
    let resetTimeout: ReturnType<typeof setTimeout> | undefined;

    const copy = async (text: string): Promise<boolean> => {
        const copied = await copyToClipboard(text);
        hasCopied.value = copied;

        if (copied) {
            clearTimeout(resetTimeout);
            resetTimeout = setTimeout(() => {
                hasCopied.value = false;
            }, resetAfterMs);
        }

        return copied;
    };

    onBeforeUnmount(() => clearTimeout(resetTimeout));

    return { copy, hasCopied };
}
