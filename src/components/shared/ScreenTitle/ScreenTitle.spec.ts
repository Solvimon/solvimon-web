import { mount } from '@vue/test-utils';
import ScreenTitle from './ScreenTitle.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountComponent = (props: { title: string; description?: string }, slots = {}) =>
    mount(ScreenTitle, { props, slots });

describe('ScreenTitle', () => {
    it('renders the title', () => {
        const wrapper = mountComponent({ title: 'Payment methods' });

        expect(wrapper.text()).toContain('Payment methods');
    });

    it('renders the description when provided', () => {
        const wrapper = mountComponent({
            title: 'Payment methods',
            description: 'Manage your payment methods',
        });

        expect(wrapper.text()).toContain('Manage your payment methods');
    });

    it('omits the description when not provided', () => {
        const wrapper = mountComponent({ title: 'Payment methods' });

        expect(wrapper.text()).toBe('Payment methods');
    });

    it('renders the right slot when provided', () => {
        const wrapper = mountComponent(
            { title: 'Payment methods' },
            { right: '<button>Add</button>' },
        );

        expect(wrapper.find('button').text()).toBe('Add');
    });

    it('omits the right slot container when no right slot is provided', () => {
        const wrapper = mountComponent({ title: 'Payment methods' });

        expect(wrapper.findAll('div')).toHaveLength(2);
    });
});
