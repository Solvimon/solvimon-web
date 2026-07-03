import type { PaymentMethod } from '@solvimon/solvimon-types';
import type { ContextMenuItemType, ContextMenuOption } from '@solvimon/solvimon-ui';
import { usePaymentMethodContextMenuOptions } from './usePaymentMethodContextMenuOptions';

const menuItems = (items: ContextMenuOption[] | undefined) => (items ?? []) as ContextMenuItemType[];

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        is_default: false,
        type: 'CARD',
        ...overrides,
    }) as unknown as PaymentMethod;

describe('usePaymentMethodContextMenuOptions', () => {
    const onSetDefault = vi.fn();
    const onDeleteRequest = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getContextMenuItems — item count', () => {
        it('returns two items for a non-default payment method', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });

            expect(menuItems(getContextMenuItems(createPaymentMethod({ is_default: false })))).toHaveLength(2);
        });

        it('returns one item for the default payment method', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });

            expect(menuItems(getContextMenuItems(createPaymentMethod({ is_default: true })))).toHaveLength(1);
        });
    });

    describe('getContextMenuItems — labels', () => {
        it('labels the items "Set as default" and "Delete" for a non-default payment method', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });

            const items = menuItems(getContextMenuItems(createPaymentMethod({ is_default: false })));

            expect(items[0].label).toBe('Set as default');
            expect(items[1].label).toBe('Delete');
        });

        it('labels the only item "Delete" for the default payment method', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });

            const items = menuItems(getContextMenuItems(createPaymentMethod({ is_default: true })));

            expect(items[0].label).toBe('Delete');
        });
    });

    describe('getContextMenuItems — onClick callbacks', () => {
        it('calls onSetDefault with the payment method when "Set as default" is clicked', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });
            const pm = createPaymentMethod({ is_default: false });

            menuItems(getContextMenuItems(pm))[0].onClick();

            expect(onSetDefault).toHaveBeenCalledWith(pm);
            expect(onDeleteRequest).not.toHaveBeenCalled();
        });

        it('calls onDeleteRequest with the payment method when "Delete" is clicked', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });
            const pm = createPaymentMethod({ is_default: false });

            menuItems(getContextMenuItems(pm))[1].onClick();

            expect(onDeleteRequest).toHaveBeenCalledWith(pm);
            expect(onSetDefault).not.toHaveBeenCalled();
        });

        it('calls onDeleteRequest when delete is clicked on the default payment method', () => {
            const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
                onSetDefault,
                onDeleteRequest,
            });
            const pm = createPaymentMethod({ is_default: true });

            menuItems(getContextMenuItems(pm))[0].onClick();

            expect(onDeleteRequest).toHaveBeenCalledWith(pm);
        });
    });
});
