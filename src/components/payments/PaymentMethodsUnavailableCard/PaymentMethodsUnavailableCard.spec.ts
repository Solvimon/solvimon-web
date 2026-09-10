import { mount } from '@vue/test-utils';
import PaymentMethodsUnavailableCard from './PaymentMethodsUnavailableCard.vue';
import type { PaymentMethodsUnavailableCardProps } from './PaymentMethodsUnavailableCard.types';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountCard = (props: PaymentMethodsUnavailableCardProps) =>
    mount(PaymentMethodsUnavailableCard, { props });

describe('PaymentMethodsUnavailableCard', () => {
    it('tells an invoice payer that the invoice cannot be paid online', () => {
        const wrapper = mountCard({ variant: 'AUTHORIZE' });

        expect(wrapper.text()).toContain('This invoice cannot be paid online');
    });

    it('tells someone storing a method that none can be added', () => {
        const wrapper = mountCard({ variant: 'TOKENIZE' });

        expect(wrapper.text()).toContain('No payment methods can be added');
    });

    it('names the seller, who is the only party that can fix it', () => {
        const wrapper = mountCard({ variant: 'AUTHORIZE', sellerName: 'AIAIAI B.V.' });

        expect(wrapper.text()).toContain('AIAIAI B.V. can settle it with you directly');
    });

    it('falls back to naming no one rather than an empty name', () => {
        const wrapper = mountCard({ variant: 'AUTHORIZE' });

        expect(wrapper.text()).toContain('The party that issued it can settle it with you');
        expect(wrapper.text()).not.toContain('{sellerName}');
    });

    it('never offers a retry, and never suggests the customer did something wrong', () => {
        const wrapper = mountCard({ variant: 'AUTHORIZE', sellerName: 'AIAIAI B.V.' });

        expect(wrapper.text()).not.toContain('Try again');
        expect(wrapper.find('button').exists()).toBe(false);
    });

    it('gives the surface somewhere to put what it can actually offer instead', () => {
        const wrapper = mount(PaymentMethodsUnavailableCard, {
            props: { variant: 'AUTHORIZE' },
            slots: { default: '<a href="#">Download invoice</a>' },
        });

        expect(wrapper.text()).toContain('Download invoice');
    });
});
