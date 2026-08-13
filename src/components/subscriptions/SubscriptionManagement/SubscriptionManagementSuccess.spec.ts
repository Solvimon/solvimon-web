import { mount } from '@vue/test-utils';
import SubscriptionManagementSuccess from './SubscriptionManagementSuccess.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(SubscriptionManagementSuccess, { props });

describe('SubscriptionManagementSuccess', () => {
    it('confirms the change was committed', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Subscription updated');
    });

    it('names the group that was changed', () => {
        const wrapper = mountComponent({ pricingGroupName: 'Credit packs' });

        expect(wrapper.find('.sv-subscription-management-success__message').text()).toBe(
            'Your Credit packs has been changed. Please be aware that it can take some time to reflect this change in your subscription.',
        );
    });

    it('stays generic when the group is not known', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-management-success__message').text()).toBe(
            'Your subscription has been changed. Please be aware that it can take some time to reflect this change in your subscription.',
        );
    });
});
