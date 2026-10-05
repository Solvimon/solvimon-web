import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ContentWithAsideLayout from './ContentWithAsideLayout.vue';

const mountLayout = (slots: Record<string, string>) =>
    mount(ContentWithAsideLayout, { slots: { content: '<p>content</p>', ...slots } });

describe('ContentWithAsideLayout', () => {
    it('renders the footer below the columns when one is given', () => {
        const wrapper = mountLayout({ footer: '<p class="terms">terms</p>' });

        expect(wrapper.find('.sv-layout__footer .terms').exists()).toBe(true);
        // After the body, so it reads as a footer rather than sitting between the columns.
        expect(wrapper.find('.sv-layout__body ~ .sv-layout__footer').exists()).toBe(true);
    });

    // Five other screens use this layout and pass no footer; they must render exactly as before.
    it('renders no footer region at all without one', () => {
        expect(mountLayout({}).find('.sv-layout__footer').exists()).toBe(false);
    });

    it('leaves the header and aside optional in the same way', () => {
        const bare = mountLayout({});
        expect(bare.find('.sv-layout__header').exists()).toBe(false);
        expect(bare.find('.sv-layout__aside').exists()).toBe(false);

        const full = mountLayout({ header: '<p>h</p>', aside: '<p>a</p>', footer: '<p>f</p>' });
        expect(full.find('.sv-layout__header').exists()).toBe(true);
        expect(full.find('.sv-layout__aside').exists()).toBe(true);
        expect(full.find('.sv-layout__footer').exists()).toBe(true);
    });
});
