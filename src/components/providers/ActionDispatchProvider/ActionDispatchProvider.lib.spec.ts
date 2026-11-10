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

    it('dispatches nothing when no host element is available', () => {
        const dispatchAction = createActionDispatcher();

        expect(() =>
            dispatchAction({ action: 'view-all-subscriptions' } as ActionRequestDetail),
        ).not.toThrow();
        expect(mockUseHostElementProvider).toHaveBeenCalledTimes(1);
    });

    it('dispatches solvimon-action-request on the host, bubbling across the shadow root', () => {
        const dispatchEvent = vi.fn().mockReturnValue(true);
        mockHostRef.value = { dispatchEvent } as unknown as HTMLElement;
        const detail: ActionRequestDetail = {
            action: 'view-invoice',
            data: { invoiceId: 'inv_123' },
        };

        createActionDispatcher()(detail);

        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        const [event] = dispatchEvent.mock.calls[0] as [CustomEvent<ActionRequestDetail>];
        expect(event).toMatchObject({
            type: 'solvimon-action-request',
            detail,
            bubbles: true,
            composed: true,
            cancelable: false,
        });
    });
});
