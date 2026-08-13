import { mount } from '@vue/test-utils';
import { computed, defineComponent, h } from 'vue';
import TranslationOverride from './TranslationOverride.vue';
import { TRANSLATION_SETTINGS_KEY } from './TranslationProvider.lib';

const { intlProviderProps } = vi.hoisted(() => ({
    intlProviderProps: vi.fn(),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');

    return createSolvimonUiMock({
        // The real one resolves an ErrorHandlingProvider that only the whole provider tree has.
        IntlProvider: defineComponent({
            name: 'IntlProviderStub',
            props: { locale: String, dateLocale: String, messages: Object },
            setup: (props, { slots }) => {
                intlProviderProps(props);

                return () => h('div', {}, slots.default?.());
            },
        }),
    });
});

const settings = {
    locale: computed(() => 'nl-NL'),
    dateLocale: computed<string | undefined>(() => 'en-US'),
    messages: computed(() => ({ greeting: 'Hallo', farewell: 'Tot ziens' })),
};

const mountComponent = ({ withSettings = true } = {}) =>
    mount(TranslationOverride, {
        props: { messages: { farewell: 'Doei' } },
        slots: { default: () => h('span', 'content') },
        global: {
            provide: withSettings ? { [TRANSLATION_SETTINGS_KEY as symbol]: settings } : {},
        },
    });

describe('TranslationOverride', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('replaces only the messages it is given', () => {
        mountComponent();

        expect(intlProviderProps).toHaveBeenCalledWith(
            expect.objectContaining({ messages: { greeting: 'Hallo', farewell: 'Doei' } }),
        );
    });

    it('keeps the locale the app resolved, so dates and numbers do not change', () => {
        mountComponent();

        expect(intlProviderProps).toHaveBeenCalledWith(
            expect.objectContaining({ locale: 'nl-NL', dateLocale: 'en-US' }),
        );
    });

    it('still renders what it wraps', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toBe('content');
    });

    it('falls back to its own overrides when mounted outside the app translations', () => {
        mountComponent({ withSettings: false });

        expect(intlProviderProps).toHaveBeenCalledWith(
            expect.objectContaining({ messages: { farewell: 'Doei' }, locale: undefined }),
        );
    });
});
