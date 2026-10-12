import { mount } from '@vue/test-utils';
import PromotionCodeSection from './PromotionCodeSection.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountSection = () => mount(PromotionCodeSection, { attachTo: document.body });

const status = (wrapper: ReturnType<typeof mountSection>) =>
    wrapper.find('[aria-live="polite"]').text();

/** Types a code and applies it, then plays the checkout: it takes the code and starts a preview. */
const apply = async (wrapper: ReturnType<typeof mountSection>, code = 'SAVE10') => {
    await wrapper.find('button[aria-expanded]').trigger('click');
    await wrapper.find('input').setValue(code);
    await wrapper.find('input').trigger('keydown', { key: 'Enter' });
    await wrapper.setProps({ promotionCode: code, isPending: true });
};

describe('PromotionCodeSection', () => {
    it('hands the checkout the code to apply, once for one press of Enter', async () => {
        const wrapper = mountSection();

        await apply(wrapper);

        expect(wrapper.emitted('apply')).toEqual([['SAVE10']]);
        expect(wrapper.emitted('update:appliedCode')).toEqual([['SAVE10']]);
    });

    it('announces nothing while the checkout is still checking the code', async () => {
        const wrapper = mountSection();

        await apply(wrapper);

        expect(status(wrapper)).toBe('');
    });

    it('announces the code once the checkout has accepted it', async () => {
        const wrapper = mountSection();
        await apply(wrapper);

        await wrapper.setProps({ isPending: false });

        expect(status(wrapper)).toBe('Promotion code applied');
    });

    it('announces nothing for a code the checkout turned down', async () => {
        const wrapper = mountSection();
        await apply(wrapper);

        await wrapper.setProps({ promotionCode: null });
        await wrapper.setProps({ isPending: false });

        expect(status(wrapper)).toBe('');
    });

    it('announces a removal straight away', async () => {
        const wrapper = mountSection();
        await apply(wrapper);
        await wrapper.setProps({ isPending: false });

        await wrapper.find('button[aria-label="Remove promotion code"]').trigger('click');

        expect(wrapper.emitted('remove')).toHaveLength(1);
        expect(status(wrapper)).toBe('Promotion code removed');
    });

    it('does not announce an apply that a removal overtook', async () => {
        const wrapper = mountSection();
        await apply(wrapper);

        await wrapper.find('button[aria-label="Remove promotion code"]').trigger('click');
        await wrapper.setProps({ promotionCode: null });
        await wrapper.setProps({ isPending: false });

        expect(status(wrapper)).toBe('Promotion code removed');
    });
});
