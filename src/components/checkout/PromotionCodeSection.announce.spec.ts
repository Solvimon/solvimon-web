import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import PromotionCodeSection from './PromotionCodeSection.vue';
import TranslationProvider from '@/components/providers/TranslationProvider/TranslationProvider.vue';

// The real `useIntl` and `Input`, so the locale catalogues and the Input's own listeners are what
// is under test rather than the global stub.
vi.mock('@solvimon/solvimon-ui', async () => vi.importActual('@solvimon/solvimon-ui'));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

type Host = {
    promotionCode: ReturnType<typeof ref<string | null>>;
    isPending: ReturnType<typeof ref<boolean>>;
    applied: string[];
    removed: number;
};

/** Plays the checkout around the section: it takes the code it is handed and starts a preview. */
const mountInHost = async (locale = 'en-US') => {
    const host: Host = {
        promotionCode: ref<string | null>(null),
        isPending: ref(false),
        applied: [],
        removed: 0,
    };

    const wrapper = mount(
        defineComponent({
            render: () =>
                h(ErrorHandlingProvider, { onError: vi.fn() }, () =>
                    h(TranslationProvider, { locale }, () =>
                        h(PromotionCodeSection, {
                            promotionCode: host.promotionCode.value,
                            isPending: host.isPending.value,
                            'onUpdate:appliedCode': (code: string | null) =>
                                (host.promotionCode.value = code),
                            onApply: (code: string) => {
                                host.applied.push(code);
                                host.isPending.value = true;
                            },
                            onRemove: () => {
                                host.removed += 1;
                                host.isPending.value = true;
                            },
                        }),
                    ),
                ),
        }),
        { attachTo: document.body },
    );
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();

    return { wrapper, host };
};

const status = (wrapper: VueWrapper) => wrapper.find('[aria-live="polite"]').text();

const typeCode = async (wrapper: VueWrapper, code: string) => {
    await wrapper.find('button[aria-expanded]').trigger('click');
    await wrapper.find('input').setValue(code);
};

const settle = async (host: Host) => {
    host.isPending.value = false;
    await flushPromises();
};

const APPLIED: Record<string, string> = {
    'en-US': 'Promotion code applied',
    'nl-NL': 'Promotiecode toegepast',
    'de-DE': 'Aktionscode angewendet',
    'it-IT': 'Codice promozionale applicato',
};

describe('PromotionCodeSection announcements (DD-3553)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it.each(Object.keys(APPLIED))(
        'announces an accepted code in %s, and only once it is accepted',
        async (locale) => {
            const { wrapper, host } = await mountInHost(locale);
            await typeCode(wrapper, 'SAVE10');

            await wrapper.find('input').trigger('keydown', { key: 'Enter' });
            await flushPromises();
            expect(status(wrapper)).toBe('');

            await settle(host);
            expect(status(wrapper)).toBe(APPLIED[locale]);
        },
    );

    it('applies once for one Enter in the real Input', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'SAVE10');

        await wrapper.find('input').trigger('keydown', { key: 'Enter' });

        expect(host.applied).toEqual(['SAVE10']);
    });

    it('still applies from the Apply button', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'SAVE10');

        await wrapper.find('button[aria-label="Apply promotion code"]').trigger('click');
        expect(host.applied).toEqual(['SAVE10']);
        expect(status(wrapper)).toBe('');

        await settle(host);
        expect(status(wrapper)).toBe('Promotion code applied');
    });

    it('ignores keys other than Enter', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'SAVE10');

        await wrapper.find('input').trigger('keydown', { key: 'a' });

        expect(host.applied).toEqual([]);
    });

    it('announces nothing for a code the checkout turned down', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'NOPE');
        await wrapper.find('input').trigger('keydown', { key: 'Enter' });

        host.promotionCode.value = null;
        await settle(host);

        expect(status(wrapper)).toBe('');
    });

    it('announces only the removal when the code is removed mid-apply', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'SAVE10');
        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await flushPromises();

        await wrapper.find('button[aria-label="Remove promotion code"]').trigger('click');
        await settle(host);

        expect(host.removed).toBe(1);
        expect(status(wrapper)).toBe('Promotion code removed');
    });

    // `usePromotionCode` keeps one pending flag for both actions, so a removal that settles while
    // the next apply is still out turns it false early. The section then announces a code that has
    // not been accepted, and may yet be turned down.
    it.fails('does not announce a code while its own preview is still out', async () => {
        const { wrapper, host } = await mountInHost();
        await typeCode(wrapper, 'FIRST');
        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await settle(host);

        // Removal goes out and is still pending...
        await wrapper.find('button[aria-label="Remove promotion code"]').trigger('click');
        await flushPromises();

        // ...when the customer applies the next code, which goes out too.
        await typeCode(wrapper, 'SECOND');
        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await flushPromises();

        // The removal comes back first: the shared flag drops, the SECOND preview is still out.
        await settle(host);

        expect(status(wrapper)).not.toBe('Promotion code applied');
    });
});
