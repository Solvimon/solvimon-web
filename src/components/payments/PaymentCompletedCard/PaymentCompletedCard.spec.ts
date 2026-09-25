import { mount } from '@vue/test-utils';
import type { Amount } from '@solvimon/solvimon-types';
import PaymentCompletedCard from './PaymentCompletedCard.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        formatAmount: (amount: Amount) => `${amount.currency} ${amount.quantity}`,
    });
});

const REDIRECT_NOTICE = 'You are being redirected';

describe('PaymentCompletedCard', () => {
    it('says nothing about a redirect when the screen stays put', () => {
        const wrapper = mount(PaymentCompletedCard, { props: { variant: 'AUTHORIZE' } });

        expect(wrapper.text()).not.toContain(REDIRECT_NOTICE);
    });

    it('announces the redirect when one follows', () => {
        const wrapper = mount(PaymentCompletedCard, {
            props: { variant: 'AUTHORIZE', redirecting: true },
        });

        expect(wrapper.text()).toContain(REDIRECT_NOTICE);
    });

    it('keeps quiet about a redirect after a payment method is stored', () => {
        const wrapper = mount(PaymentCompletedCard, {
            props: { variant: 'TOKENIZE', redirecting: false },
        });

        expect(wrapper.text()).toContain('Your payment method is added');
        expect(wrapper.text()).not.toContain(REDIRECT_NOTICE);
    });
});
