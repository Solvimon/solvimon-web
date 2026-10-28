import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ContentWithAsideLayout from './ContentWithAsideLayout.vue';

const mountLayout = (slots: Record<string, string>) =>
    mount(ContentWithAsideLayout, { slots: { content: '<p>content</p>', ...slots } });

describe('ContentWithAsideLayout', () => {
    it('leaves the header and aside optional', () => {
        const bare = mountLayout({});
        expect(bare.find('.sv-layout__header').exists()).toBe(false);
        expect(bare.find('.sv-layout__aside').exists()).toBe(false);

        const full = mountLayout({ header: '<p>h</p>', aside: '<p>a</p>' });
        expect(full.find('.sv-layout__header').exists()).toBe(true);
        expect(full.find('.sv-layout__aside').exists()).toBe(true);
    });
});
