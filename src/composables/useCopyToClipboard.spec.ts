import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { useCopyToClipboard } from './useCopyToClipboard';

const mockWriteText = vi.fn().mockResolvedValue(undefined);

const mountComposable = () => {
    let api: ReturnType<typeof useCopyToClipboard>;
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useCopyToClipboard({ resetAfterMs: 50 });
                return () => null;
            },
        }),
    );
    return { wrapper, api: api! };
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        configurable: true,
    });
});

describe('useCopyToClipboard', () => {
    it('copies and confirms', async () => {
        const { api } = mountComposable();

        await api.copy('SV-7F3K2A9Q');

        expect(mockWriteText).toHaveBeenCalledWith('SV-7F3K2A9Q');
        expect(api.hasCopied.value).toBe(true);
    });

    it('lets the confirmation fade by itself', async () => {
        vi.useFakeTimers();
        const { api } = mountComposable();

        await api.copy('SV-7F3K2A9Q');
        vi.advanceTimersByTime(50);
        await nextTick();

        expect(api.hasCopied.value).toBe(false);
        vi.useRealTimers();
    });

    it('does not confirm a copy that failed', async () => {
        mockWriteText.mockRejectedValueOnce(new Error('Write permission denied.'));
        const { api } = mountComposable();

        expect(await api.copy('SV-7F3K2A9Q')).toBe(false);
        expect(api.hasCopied.value).toBe(false);
    });

    it('cannot write to a component that has gone away', async () => {
        vi.useFakeTimers();
        const { wrapper, api } = mountComposable();

        await api.copy('SV-7F3K2A9Q');
        wrapper.unmount();

        expect(() => vi.advanceTimersByTime(50)).not.toThrow();
        expect(api.hasCopied.value).toBe(true);
        vi.useRealTimers();
    });
});
