import { mount } from '@vue/test-utils';
import { h } from 'vue';
import LimitedList from './LimitedList.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const items = ['a', 'b', 'c', 'd'];

const mountList = (
    props: { limit: number } & Record<string, unknown>,
    slots: Record<string, unknown> = {},
) =>
    mount(LimitedList<string>, {
        props: { items, itemKey: (item: string) => item, ...props },
        slots: {
            item: ({ item }: { item: string }) => h('span', { class: 'row' }, item),
            ...slots,
        },
    });

describe('LimitedList', () => {
    it('shows the first items up to the limit and counts the rest', () => {
        const wrapper = mountList({ limit: 3, moreClass: 'more' });

        expect(wrapper.findAll('.row').map((row) => row.text())).toEqual(['a', 'b', 'c']);
        expect(wrapper.find('.more').text()).toBe('+ 1 more');
    });

    it('leaves the count out when nothing is left out', () => {
        const wrapper = mountList({ limit: 4, moreClass: 'more' });

        expect(wrapper.find('.more').exists()).toBe(false);
    });

    it('lets the caller word the count', () => {
        const wrapper = mountList(
            { limit: 2, moreClass: 'more' },
            { more: ({ count }: { count: number }) => `+ ${count} available` },
        );

        expect(wrapper.find('.more').text()).toBe('+ 2 available');
    });

    it('offers to show all items, with the total, when it is given a way to', async () => {
        const showAll = vi.fn();
        const wrapper = mountList({ limit: 3, moreClass: 'more', showAll });

        expect(wrapper.find('.more').text()).toBe('Show all 4');
        await wrapper.find('.more button').trigger('click');

        expect(showAll).toHaveBeenCalledOnce();
    });

    it('puts the given classes on each item', () => {
        const wrapper = mountList({ limit: 4, itemClass: 'item' });

        expect(wrapper.findAll('li.item')).toHaveLength(4);
    });
});
