import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import type { Invoice, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import OrderSummary from './OrderSummary.vue';
import type { UsagePriceGroup } from './OrderSummaryUsage.lib';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    const { mockUseIntl } = await import('@/test-utils/useIntlMock');
    return createSolvimonUiMock({
        // Grouped as a customer's locale would, which the shared mock leaves out.
        useIntl: () => ({
            ...mockUseIntl(),
            formatNumber: (value: number) => new Intl.NumberFormat('en-US').format(value),
        }),
        useTimePeriod: () => ({ map: ref({ MONTH: { full: 'monthly' } }) }),
        // Resolves its own IntlProvider, which is not mounted here.
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            setup: () => () => h('div', { class: 'sv-invoice-preview-stub' }),
        }),
        InvoicePreviewGroups: defineComponent({
            name: 'InvoicePreviewGroupsStub',
            setup: () => () => h('div'),
        }),
    });
});

const subscription = {
    id: 'ppsu_1',
    name: 'Pro',
    billing_period: { type: 'MONTH', value: 1 },
    billing_currency: 'EUR',
    pricing_plan_schedule_infos: [],
} as unknown as PricingPlanSubscriptionExpanded;

const line = (pricingItemConfigId: string, number?: string) => ({
    type: 'REVENUE',
    pricing_item_config_id: pricingItemConfigId,
    details: number ? { meter_value: { number } } : {},
});
const group = (name: string, ...lines: ReturnType<typeof line>[]) => ({
    type: 'REVENUE',
    pricing: { name },
    amount_excluding_tax: { quantity: '1.00', currency: 'EUR' },
    lines,
});
const invoiceOf = (...groups: ReturnType<typeof group>[]) =>
    ({
        id: 'invo_1',
        billing_currency: 'EUR',
        lines: [],
        periods: [{ groups }],
    }) as unknown as Invoice;

const mountSummary = (invoice: Invoice, isUpdating?: boolean) =>
    mount(OrderSummary, {
        props: { subscription, invoice, countryCode: 'NL', isUpdating },
        global: { stubs: { SubscriptionSummary: true } },
    });
const countsOf = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('.sv-order-summary__quantity').map((count) => ({
        text: count.text(),
        style: count.attributes('style'),
    }));

describe('OrderSummary', () => {
    it('lists every line of the invoice in one card', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Staff seats', line('pico_seats', '5')),
            ),
        );

        const cards = wrapper.findAll('.sv-order-summary__lines');
        expect(cards).toHaveLength(1);
        expect(cards[0].text()).toContain('Platform');
        expect(cards[0].text()).toContain('Staff seats');
    });

    it('starts each line with how many it charges, in a column as wide as the widest', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Staff seats', line('pico_seats', '1'), line('pico_seats', '11')),
                group('Bundle', line('pico_a'), line('pico_b', '3')),
            ),
        );

        // A line of several prices shows no count, but keeps the column so its name lines up.
        expect(countsOf(wrapper)).toEqual([
            { text: '1', style: 'min-width: 2ch;' },
            { text: '12', style: 'min-width: 2ch;' },
            { text: '', style: 'min-width: 2ch;' },
        ]);
    });

    it('shortens a large count and keeps the whole number for its tooltip', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Records', line('pico_records', '13182678')),
            ),
        );

        expect(countsOf(wrapper)).toEqual([
            { text: '1', style: 'min-width: 4ch;' },
            { text: '13M+', style: 'min-width: 4ch;' },
        ]);
        const tooltips = wrapper.findAllComponents({ name: 'Tooltip' });
        expect(tooltips).toHaveLength(1);
        expect(tooltips[0].text()).toContain('13M+');
    });

    describe('usage prices', () => {
        const usagePriceGroups: UsagePriceGroup[] = [
            {
                name: 'Payments',
                prices: [
                    {
                        name: 'Cards',
                        billingPeriod: { type: 'MONTH', value: 1 },
                        rate: '€0.05 / transaction',
                    },
                    {
                        name: 'Payouts',
                        billingPeriod: { type: 'MONTH', value: 1 },
                        tiers: [
                            { range: '0 - 20,000', rate: '€0.05 / transaction' },
                            { range: '20,000+', rate: '€0.04 / transaction' },
                        ],
                    },
                ],
            },
        ];
        const mountUsage = (groups?: UsagePriceGroup[]) =>
            mount(OrderSummary, {
                props: {
                    subscription,
                    invoice: invoiceOf(group('Platform', line('pico_fee'))),
                    countryCode: 'NL',
                    isUsageBased: true,
                    usagePriceGroups: groups,
                },
                global: { stubs: { SubscriptionSummary: true } },
            });

        const panelOf = (wrapper: ReturnType<typeof mountUsage>) =>
            wrapper.find(
                `#${wrapper.find('.sv-order-summary__usage button').attributes('aria-controls')}`,
            );
        // Expand mounts lazy content a frame after it first opens.
        const open = async (toggle: ReturnType<ReturnType<typeof mountUsage>['find']>) => {
            await toggle.trigger('click');
            await new Promise(requestAnimationFrame);
            await nextTick();
        };

        it('collapses to the usage line and how often it is billed', () => {
            const wrapper = mountUsage(usagePriceGroups);
            const toggle = wrapper.find('.sv-order-summary__usage button');

            expect(toggle.text()).toMatch(/^\+ Usage\s*Billed monthly$/);
            expect(toggle.attributes('aria-expanded')).toBe('false');
            expect(panelOf(wrapper).attributes('inert')).toBeDefined();
        });

        it('expands to the prices under their category when clicked', async () => {
            const wrapper = mountUsage(usagePriceGroups);
            const toggle = wrapper.find('.sv-order-summary__usage button');

            await open(toggle);

            expect(toggle.attributes('aria-expanded')).toBe('true');
            expect(panelOf(wrapper).attributes('inert')).toBeUndefined();
            expect(panelOf(wrapper).text()).toContain('Payments');
            expect(
                wrapper.findAll('.sv-order-summary__usage-price').map((row) => row.text()),
            ).toEqual([
                expect.stringMatching(/Cards\s*€0.05 \/ transaction/),
                'Payouts',
                expect.stringMatching(/0 - 20,000\s*€0.05 \/ transaction/),
                expect.stringMatching(/20,000\+\s*€0.04 \/ transaction/),
            ]);
        });

        it('keeps the prices mounted but inert once closed again, so it can animate shut', async () => {
            const wrapper = mountUsage(usagePriceGroups);
            const toggle = wrapper.find('.sv-order-summary__usage button');

            await open(toggle);
            await toggle.trigger('click');

            expect(toggle.attributes('aria-expanded')).toBe('false');
            expect(panelOf(wrapper).attributes('inert')).toBeDefined();
            expect(wrapper.findAll('.sv-order-summary__usage-price')).toHaveLength(4);
        });

        it('places the usage line after the product lines and before the totals', () => {
            const wrapper = mountUsage(usagePriceGroups);
            const order = [
                '.sv-order-summary__lines',
                '.sv-order-summary__usage',
                '.sv-order-summary__totals',
            ].map((selector) => wrapper.find(selector).element);

            expect(order[0].compareDocumentPosition(order[1])).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
            expect(order[1].compareDocumentPosition(order[2])).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
        });

        it('keeps the plain usage line without usage prices', () => {
            const usage = mountUsage().find('.sv-order-summary__usage');

            expect(usage.text()).toBe('+ Usage');
            expect(usage.find('button').exists()).toBe(false);
            expect(usage.findComponent({ name: 'Icon' }).exists()).toBe(false);
        });

        it('says nothing of the period when the usage prices are billed over different ones', () => {
            const groups: UsagePriceGroup[] = [
                {
                    name: 'Payments',
                    prices: [
                        { name: 'Cards', billingPeriod: { type: 'MONTH', value: 1 } },
                        { name: 'Payouts', billingPeriod: { type: 'YEAR', value: 1 } },
                    ],
                },
            ];

            expect(mountUsage(groups).find('.sv-order-summary__usage button').text()).toBe(
                '+ Usage',
            );
        });
    });

    it('says the price is being updated and marks the invoice busy while a change is priced', () => {
        const wrapper = mountSummary(invoiceOf(), true);

        expect(wrapper.find('.sv-order-summary__updating[role="status"]').exists()).toBe(true);
        const totals = wrapper.find('.sv-order-summary__totals');
        expect(totals.attributes('aria-busy')).toBe('true');
        expect(totals.classes()).toContain('blur');
    });

    it('shows the invoice as current when nothing is being priced', () => {
        const wrapper = mountSummary(invoiceOf());

        expect(wrapper.find('.sv-order-summary__updating').exists()).toBe(false);
        const totals = wrapper.find('.sv-order-summary__totals');
        expect(totals.attributes('aria-busy')).not.toBe('true');
        expect(totals.classes()).not.toContain('blur');
        expect(totals.classes()).toContain('transition');
    });
});
