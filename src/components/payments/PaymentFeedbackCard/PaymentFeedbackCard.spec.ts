import { mount } from '@vue/test-utils';
import PaymentFeedbackCard from './PaymentFeedbackCard.vue';

describe('PaymentFeedbackCard', () => {
    // The customer pressed Pay elsewhere on the page, so the outcome has to reach a screen reader.
    it.each([
        ['success', 'status'],
        ['error', 'alert'],
    ] as const)('announces a %s, as a %s', (status, role) => {
        const wrapper = mount(PaymentFeedbackCard, { props: { status, title: 'Payment' } });

        expect(wrapper.find(`[role="${role}"]`).text()).toContain('Payment');
    });
});
