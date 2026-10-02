import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MarkdownText from './MarkdownText.vue';

const render = (source?: string | null) => mount(MarkdownText, { props: { source } });

describe('MarkdownText', () => {
    it('renders nothing at all for an empty note', () => {
        expect(render(undefined).html()).toBe('<!--v-if-->');
        expect(render('').html()).toBe('<!--v-if-->');
    });

    it('renders the emphases as real elements', () => {
        const wrapper = render('**bold** and *italic* and <u>underline</u>');

        expect(wrapper.find('strong').text()).toBe('bold');
        expect(wrapper.find('em').text()).toBe('italic');
        expect(wrapper.find('u').text()).toBe('underline');
    });

    it('opens a link in a new tab without handing over the opener', () => {
        const link = render('[Terms](https://example.com/terms)').find('a');

        expect(link.attributes('href')).toBe('https://example.com/terms');
        expect(link.attributes('target')).toBe('_blank');
        expect(link.attributes('rel')).toBe('noopener noreferrer');
        expect(link.text()).toBe('Terms');
    });

    it('splits paragraphs', () => {
        expect(render('One\n\nTwo').findAll('p')).toHaveLength(2);
    });

    describe('a note is merchant-authored and shown to their customers', () => {
        it('renders a script tag as text, not as a script', () => {
            const wrapper = render('<script>alert(1)</script>');

            expect(wrapper.find('script').exists()).toBe(false);
            expect(wrapper.text()).toContain('<script>alert(1)</script>');
        });

        it('renders an image payload as text, so no handler can fire', () => {
            const source = '<img src=x onerror="alert(1)">';
            const wrapper = render(source);

            expect(wrapper.find('img').exists()).toBe(false);
            // Present as escaped text, which is inert, and never as an attribute.
            expect(wrapper.html()).toContain('&lt;img src=x onerror="alert(1)"&gt;');
            expect(wrapper.text()).toBe(source);
        });

        it('does not emit a javascript: href', () => {
            // eslint-disable-next-line no-script-url -- the vector under test
            const wrapper = render('[Click me](javascript:alert(1))');

            expect(wrapper.find('a').exists()).toBe(false);
            expect(wrapper.text()).toContain('Click me');
            expect(wrapper.html()).not.toContain('javascript:');
        });

        it('escapes anything that would otherwise close a tag', () => {
            const wrapper = render('</p><svg onload=alert(1)>');

            expect(wrapper.find('svg').exists()).toBe(false);
            expect(wrapper.findAll('p')).toHaveLength(1);
            expect(wrapper.html()).toContain('&lt;/p&gt;&lt;svg onload=alert(1)&gt;');
        });
    });
});
