import { mount } from '@vue/test-utils';
import type { Invoice, WalletBalanceValue } from '@solvimon/solvimon-types';
import InvoiceCreditsBreakdown from './InvoiceCreditsBreakdown.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const credits = (quantity: string): WalletBalanceValue => ({
    credits: { quantity, credit_type_id: 'ctyp_1' },
});

const createInvoice = ({ timezone }: { timezone?: string } = {}): Invoice =>
    ({
        timezone,
        customer: { timezone: 'Europe/Amsterdam' },
        credit_types: [{ id: 'ctyp_1', name: 'OpenAI credits' }],
        periods: [
            {
                period_order: 1,
                start_at: '2026-03-31T22:30:00Z',
                end_at: '2026-04-30T21:59:59Z',
                groups: [
                    {
                        group_order: 1,
                        lines: [
                            {
                                line_order: 1,
                                details: {
                                    wallet_balances: [
                                        {
                                            wallet_id: 'wal_1',
                                            used_balance: credits('10'),
                                            left_balance: credits('90'),
                                            available_balance: credits('100'),
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }) as unknown as Invoice;

describe('InvoiceCreditsBreakdown', () => {
    const mountComponent = (invoice = createInvoice()) =>
        mount(InvoiceCreditsBreakdown, { props: { invoice } });

    it('toggles a credit type with a real button that says whether it is open', async () => {
        const wrapper = mountComponent();
        const toggle = wrapper.get('button');

        expect(toggle.attributes('type')).toBe('button');
        expect(toggle.text()).toContain('OpenAI credits');
        expect(toggle.attributes('aria-expanded')).toBe('false');
        expect(wrapper.text()).not.toContain('Wallet breakdown');

        await toggle.trigger('click');

        expect(toggle.attributes('aria-expanded')).toBe('true');
        expect(wrapper.text()).toContain('Wallet breakdown');
    });

    it('leaves the row itself out of the tab order', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('tr[tabindex]').exists()).toBe(false);
    });

    it('dates the service period in the timezone the invoice was issued in', () => {
        const wrapper = mountComponent(createInvoice({ timezone: 'UTC' }));

        expect(wrapper.text()).toContain('31/03/2026');
        expect(wrapper.text()).not.toContain('01/04/2026');
    });
});
