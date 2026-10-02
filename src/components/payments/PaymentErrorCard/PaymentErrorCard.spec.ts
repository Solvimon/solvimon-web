import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentErrorCard from './PaymentErrorCard.vue';
import { createErrorMap } from './PaymentErrorCard.lib';
import { mockUseIntl } from '@/test-utils/useIntlMock';

const mockWriteText = vi.fn().mockResolvedValue(undefined);

const mountCard = (error: { code: string; message: string; reference?: string }) =>
    mount(PaymentErrorCard, { props: { error } as never });

const reference = (wrapper: ReturnType<typeof mountCard>) =>
    wrapper.find('[data-testid="payment-error-reference"]');

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        configurable: true,
    });
});

describe('createErrorMap', () => {
    it('describes every code the card can be handed', () => {
        const map = createErrorMap(mockUseIntl().$t as never);

        expect(Object.values(map).every((entry) => entry.title && entry.message)).toBe(true);
    });

    it('offers a retry where starting over could work, and not where it cannot', () => {
        const map = createErrorMap(mockUseIntl().$t as never);

        expect(map.AUTHORIZATION_FAILED.isReloadButtonVisible).toBe(true);
        expect(map.REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING.isReloadButtonVisible).toBeUndefined();
    });
});

describe('PaymentErrorCard', () => {
    it('shows the reference the customer can quote to support', () => {
        const wrapper = mountCard({
            code: 'AUTHORIZATION_FAILED',
            message: 'Payment failed',
            reference: 'SV-7F3K2A9Q',
        });

        expect(reference(wrapper).text()).toBe('SV-7F3K2A9Q');
        expect(wrapper.text()).toContain('Share this reference with support');
    });

    it('says nothing about a reference when there is none', () => {
        const wrapper = mountCard({ code: 'AUTHORIZATION_FAILED', message: 'Payment failed' });

        expect(reference(wrapper).exists()).toBe(false);
        expect(wrapper.text()).not.toContain('Share this reference');
    });

    it('tells the customer what failed rather than one message for everything', () => {
        const declined = mountCard({ code: 'AUTHORIZATION_FAILED', message: 'x' });
        const formFailed = mountCard({
            code: 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
            message: 'x',
        });

        expect(declined.text()).not.toBe(formFailed.text());
    });

    it('copies the reference', async () => {
        const wrapper = mountCard({
            code: 'AUTHORIZATION_FAILED',
            message: 'Payment failed',
            reference: 'SV-7F3K2A9Q',
        });

        await wrapper.find('button[aria-label="Copy reference"]').trigger('click');
        await nextTick();

        expect(mockWriteText).toHaveBeenCalledWith('SV-7F3K2A9Q');
    });

    it('leaves the reference on screen when the clipboard refuses', async () => {
        mockWriteText.mockRejectedValueOnce(new Error('Write permission denied.'));

        const wrapper = mountCard({
            code: 'AUTHORIZATION_FAILED',
            message: 'Payment failed',
            reference: 'SV-7F3K2A9Q',
        });

        await wrapper.find('button[aria-label="Copy reference"]').trigger('click');
        await nextTick();

        expect(reference(wrapper).text()).toBe('SV-7F3K2A9Q');
    });
});
