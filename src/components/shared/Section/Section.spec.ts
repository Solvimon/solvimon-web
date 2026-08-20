import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import Section from './Section.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Section: defineComponent({
            name: 'UiSectionStub',
            props: {
                title: String,
                contentClasses: String,
                contentBackground: String,
                noSpacing: Boolean,
                noBorder: Boolean,
                hasError: Boolean,
            },
            template: `
                <div class="section" :class="contentClasses">
                    <div class="right"><slot name="right" /></div>
                    <slot />
                </div>
            `,
        }),
    });
});

const mountSection = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
    mount(Section, { props, slots: { default: 'Auto top-up', ...slots } });

const section = (wrapper: ReturnType<typeof mountSection>) =>
    wrapper.findComponent({ name: 'UiSectionStub' });

const inset = (wrapper: ReturnType<typeof mountSection>, edge: 'left' | 'inset-y') => {
    const classes = section(wrapper).props('contentClasses') ?? '';

    return Number(new RegExp(`before:${edge}-([\\d.]+)`).exec(classes)?.[1]);
};

describe('Section', () => {
    it('draws a primary line down the left of the section', () => {
        const classes = section(mountSection({ emphasized: true })).props('contentClasses') ?? '';

        expect(classes).toContain('before:bg-primary-600');
        expect(classes).toMatch(/before:w-[\d.]+/);
    });

    it('holds the line off the left edge', () => {
        expect(inset(mountSection({ emphasized: true }), 'left')).toBeGreaterThan(0);
    });

    it('holds the line off the top and bottom edges', () => {
        expect(inset(mountSection({ emphasized: true }), 'inset-y')).toBeGreaterThan(0);
    });

    it('positions the line against the section box', () => {
        expect(section(mountSection({ emphasized: true })).props('contentClasses')).toContain(
            'relative',
        );
    });

    it('leaves the section its own borders', () => {
        const classes = section(mountSection({ emphasized: true })).props('contentClasses') ?? '';

        expect(classes).not.toContain('border-l');
    });

    it('keeps classes the caller asked for alongside the accent', () => {
        const classes = section(
            mountSection({ emphasized: true, contentClasses: 'min-h-24' }),
        ).props('contentClasses') as string;

        expect(classes).toContain('min-h-24');
        expect(classes).toContain('before:bg-primary-600');
    });

    describe('without the emphasis', () => {
        it('draws no accent', () => {
            const classes = section(mountSection()).props('contentClasses') ?? '';

            expect(classes).not.toContain('before:');
            expect(classes).not.toContain('sv-section__accent');
        });

        it('still passes on the classes the caller asked for', () => {
            expect(
                section(mountSection({ contentClasses: 'min-h-24' })).props('contentClasses'),
            ).toBe('min-h-24');
        });
    });

    it('keeps the emphasis to itself', () => {
        const wrapper = mountSection({ emphasized: true });

        expect(section(wrapper).attributes('emphasized')).toBeUndefined();
    });

    it('renders what it is given', () => {
        expect(mountSection().text()).toContain('Auto top-up');
    });

    it('forwards the slot a titled section puts opposite its title', () => {
        const wrapper = mountSection({ title: 'Wallet' }, { right: 'Manage' });

        expect(wrapper.find('.right').text()).toBe('Manage');
    });

    it.each([
        ['title', 'Wallet'],
        ['contentBackground', 'none'],
        ['noSpacing', true],
        ['noBorder', true],
        ['hasError', true],
    ])('passes %s through to the section', (prop, value) => {
        expect(section(mountSection({ [prop]: value })).props(prop)).toBe(value);
    });
});
