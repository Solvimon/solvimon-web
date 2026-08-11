import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useAutoApplyPromotionCode } from './useAutoApplyPromotionCode';

function withSetup(composable: () => void) {
    const wrapper = mount(
        defineComponent({
            setup() {
                composable();
                return () => h('div');
            },
        }),
    );
    return wrapper;
}

describe('useAutoApplyPromotionCode', () => {
    it('applies the promotion code once the subscription is loaded', async () => {
        const subscription = ref<{ id: string } | undefined>(undefined);
        const appliedPromotionCode = ref<string | null>(null);
        const applyPromotionCode = vi.fn();

        withSetup(() =>
            useAutoApplyPromotionCode({
                subscription,
                promotionCode: 'WELCOME10',
                appliedPromotionCode,
                applyPromotionCode,
            }),
        );

        expect(applyPromotionCode).not.toHaveBeenCalled();
        expect(appliedPromotionCode.value).toBeNull();

        subscription.value = { id: 'sub_123' };
        await nextTick();

        expect(appliedPromotionCode.value).toBe('WELCOME10');
        expect(applyPromotionCode).toHaveBeenCalledWith('WELCOME10');
        expect(applyPromotionCode).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no promotion code is provided', async () => {
        const subscription = ref<{ id: string } | undefined>(undefined);
        const appliedPromotionCode = ref<string | null>(null);
        const applyPromotionCode = vi.fn();

        withSetup(() =>
            useAutoApplyPromotionCode({
                subscription,
                promotionCode: undefined,
                appliedPromotionCode,
                applyPromotionCode,
            }),
        );

        subscription.value = { id: 'sub_123' };
        await nextTick();

        expect(applyPromotionCode).not.toHaveBeenCalled();
        expect(appliedPromotionCode.value).toBeNull();
    });

    it('only applies once, even if the subscription ref changes again', async () => {
        const subscription = ref<{ id: string } | undefined>(undefined);
        const appliedPromotionCode = ref<string | null>(null);
        const applyPromotionCode = vi.fn();

        withSetup(() =>
            useAutoApplyPromotionCode({
                subscription,
                promotionCode: 'WELCOME10',
                appliedPromotionCode,
                applyPromotionCode,
            }),
        );

        subscription.value = { id: 'sub_123' };
        await nextTick();
        subscription.value = { id: 'sub_456' };
        await nextTick();

        expect(applyPromotionCode).toHaveBeenCalledTimes(1);
    });
});
