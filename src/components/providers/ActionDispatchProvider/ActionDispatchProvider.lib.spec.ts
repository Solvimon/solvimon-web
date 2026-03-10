import type { ActionRequestDetail } from './ActionDispatchProvider.lib.types';
import { createActionDispatcher } from './ActionDispatchProvider.lib';

const { mockHostRef, mockUseHostElementProvider } = vi.hoisted(() => {
    const mockHostRef: { value: HTMLElement | null } = { value: null };

    const mockUseHostElementProvider = vi.fn(() => ({
        hostRef: mockHostRef,
    }));

    return { mockHostRef, mockUseHostElementProvider };
});

vi.mock('@/components/providers/HostElementProvider/composables/useHostElementProvider', () => ({
    useHostElementProvider: mockUseHostElementProvider,
}));

describe('createActionDispatcher', () => {
    beforeEach(() => {
        mockHostRef.value = null;
        vi.clearAllMocks();
    });

    it('returns true when no host element is available', () => {
        const dispatchAction = createActionDispatcher();

        const result = dispatchAction(
            { action: 'view-all-subscriptions' } as ActionRequestDetail,
            undefined,
        );

        expect(result).toBe(true);
        expect(mockUseHostElementProvider).toHaveBeenCalledTimes(1);
    });

    it('dispatches an action-request event on the host element and returns dispatch result', () => {
        const dispatchEvent = vi.fn().mockReturnValue(true);
        const hostElement = { dispatchEvent } as unknown as HTMLElement;
        mockHostRef.value = hostElement;

        const dispatchAction = createActionDispatcher();
        const detail: ActionRequestDetail = {
            action: 'view-invoice',
            data: { invoiceId: 'inv_123' },
        };

        const result = dispatchAction(detail, undefined);

        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        const [eventArg] = dispatchEvent.mock.calls[0] as [CustomEvent<ActionRequestDetail>];
        expect(eventArg.type).toBe('action-request');
        expect(eventArg.detail).toEqual(detail);
        expect(eventArg.bubbles).toBe(true);
        expect(eventArg.composed).toBe(true);
        expect(eventArg.cancelable).toBe(true);
        expect(result).toBe(true);
    });

    it('prevents the original event when dispatch is not allowed', () => {
        const dispatchEvent = vi.fn().mockReturnValue(false);
        const hostElement = { dispatchEvent } as unknown as HTMLElement;
        mockHostRef.value = hostElement;

        const dispatchAction = createActionDispatcher();
        const preventDefault = vi.fn();
        const originalEvent = { preventDefault } as unknown as Event;
        const detail: ActionRequestDetail = {
            action: 'view-invoice',
            data: { invoiceId: 'inv_456' },
        };

        const result = dispatchAction(detail, originalEvent);

        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });
});

