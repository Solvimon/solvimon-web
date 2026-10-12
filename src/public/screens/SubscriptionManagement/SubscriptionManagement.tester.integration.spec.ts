import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref } from 'vue';
import type { PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import SubscriptionManagement from './SubscriptionManagement.vue';

/**
 * Drives the screen with the real upgrade preview composable, so the commit gating is exercised
 * against the preview's own pending, settled and failed states rather than fixed refs.
 */

const {
    mockUseSubscription,
    mockUseLoadInitialData,
    mockUsePaymentMethods,
    mockGetInvoicePreview,
    mockCreatePricingPlanSchedule,
} = vi.hoisted(() => ({
    mockUseSubscription: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockUsePaymentMethods: vi.fn(),
    mockGetInvoicePreview: vi.fn(),
    mockCreatePricingPlanSchedule: vi.fn(),
}));

vi.mock('@/services/pricingPlanSchedules', () => ({
    createPricingPlanSchedulesService: () => ({
        createPricingPlanSchedule: mockCreatePricingPlanSchedule,
    }),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoicePreview: mockGetInvoicePreview }),
}));

vi.mock('@/composables/usePaymentMethodOptions', () => ({
    usePaymentMethodOptions: () => ({ paymentMethodOptions: ref([]), get: vi.fn() }),
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    const { createTestPortalObject: createPortal } =
        await import('@/test-utils/portalObjectFixture');
    const { ref } = await import('vue');

    return {
        ...createProviderMock(),
        usePortal: () => ref(createPortal()),
        useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
        useActionDispatchProvider: () => ({ dispatchAction: vi.fn() }),
    };
});

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: mockUsePaymentMethods,
}));

vi.mock('@/components/subscriptions/SubscriptionManagement/SubscriptionManagementForm.vue', () => ({
    default: defineComponent({
        name: 'SubscriptionManagementForm',
        props: {
            pricingGroup: { type: Object, required: true },
            paymentMethods: { type: Array, default: () => [] },
            billingPeriod: { type: Object, required: true },
            enabledPricingIds: { type: Array, required: true },
            paymentMethodId: String,
            disabled: Boolean,
        },
        emits: ['submit', 'update:enabledPricingIds', 'update:paymentMethodId'],
        setup: (props, { emit }) => {
            onMounted(() => {
                const [first] = props.paymentMethods as { id: string }[];

                if (first) {
                    emit('update:paymentMethodId', first.id);
                }
            });

            return () =>
                h('form', {
                    class: 'sv-subscription-management-form-stub',
                    onSubmit: (event: Event) => {
                        event.preventDefault();
                        emit('submit');
                    },
                });
        },
    }),
}));

vi.mock(
    '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSummary.vue',
    () => ({
        default: defineComponent({
            name: 'SubscriptionManagementSummary',
            props: { invoice: Object, isPending: Boolean, hasError: Boolean },
            setup: () => () => h('div', { class: 'sv-subscription-management-summary-stub' }),
        }),
    }),
);

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'sv-error-notification-stub' }, props.title),
        }),
    });
});

vi.mock('@/composables/useSubscription', () => ({
    useSubscription: mockUseSubscription,
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: mockUseLoadInitialData,
}));

const NOW = new Date('2026-08-06T12:00:00.000Z');

const creditsGroup = {
    id: 'pgr_credits',
    name: 'Credit packs',
    pricings: [{ id: 'pri_1000' }, { id: 'pri_5000' }],
};

const supportGroup = {
    id: 'pgr_support',
    name: 'Support',
    pricings: [{ id: 'pri_support_basic' }, { id: 'pri_support_plus' }],
};

const activeScheduleInfo = {
    id: 'ppsc_active',
    pricing_plan_version_id: 'ppve_1',
    start_at: '2026-01-01T00:00:00.000Z',
    pricing_plan_schedule: {
        id: 'ppsc_active',
        type: 'DEFAULT',
        start_at: '2026-01-01T00:00:00.000Z',
        billing_period: { type: 'MONTH', value: 1 },
        enabled_pricings: [{ pricing_id: 'pri_1000' }],
    },
    pricing_plan_version: { pricing_categories: [{ pricing_groups: [creditsGroup] }] },
};

const subscription = {
    id: 'ppsu_1',
    payment_method_id: 'pm_saved',
    pricing_plan_schedule_infos: [activeScheduleInfo],
} as unknown as PricingPlanSubscriptionExpanded;

/** Credit packs customized for this subscription; support is enabled on the plan as it stands. */
const customizedSubscription = {
    ...subscription,
    pricing_plan_schedule_infos: [
        {
            ...activeScheduleInfo,
            pricing_plan_schedule: {
                ...activeScheduleInfo.pricing_plan_schedule,
                enabled_pricings: [{ pricing_id: 'pri_support_basic' }],
                override_pricings: [{ id: 'pri_1000_custom', original_pricing_id: 'pri_1000' }],
            },
            pricing_plan_version: {
                pricing_categories: [{ pricing_groups: [creditsGroup, supportGroup] }],
            },
        },
    ],
} as unknown as PricingPlanSubscriptionExpanded;

const activeMethod = { id: 'pm_saved', status: 'ACTIVE', type: 'CARD' } as unknown as PaymentMethod;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
};

const mountComponent = ({
    enabledPricingId,
    sub = subscription,
    paymentMethods = [activeMethod],
}: {
    enabledPricingId?: string;
    sub?: PricingPlanSubscriptionExpanded;
    paymentMethods?: PaymentMethod[];
} = {}) => {
    mockUseSubscription.mockReturnValue({
        subscription: ref(sub),
        get: vi.fn(),
        error: ref(null),
    });
    mockUsePaymentMethods.mockReturnValue({ items: ref(paymentMethods), fetchAll: vi.fn() });
    mockUseLoadInitialData.mockReturnValue({ isLoading: ref(false) });

    return mount(SubscriptionManagement, {
        props: { configuration: { subscriptionId: 'ppsu_1', enabledPricingId } },
        attachTo: document.body,
    });
};

const form = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findComponent({ name: 'SubscriptionManagementForm' });

const isDisabled = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.find('.sv-subscription-management__update').attributes('disabled') !== undefined;

const choose = async (wrapper: ReturnType<typeof mountComponent>, pricingIds: string[]) => {
    form(wrapper).vm.$emit('update:enabledPricingIds', pricingIds);
    await flushPromises();
};

enableAutoUnmount(afterEach);

describe('SubscriptionManagement (tester, DD-3544)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreatePricingPlanSchedule.mockResolvedValue({ id: 'ppsc_new' });
        mockGetInvoicePreview.mockResolvedValue({ invoice: { id: 'invo_preview' } });
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('commit gating against the real preview', () => {
        it('is disabled on open, while the schedule is what is selected', async () => {
            const wrapper = mountComponent();
            await flushPromises();

            expect(mockGetInvoicePreview).toHaveBeenCalled();
            expect(isDisabled(wrapper)).toBe(true);
        });

        it('is disabled while the change is priced and enabled once the price is in', async () => {
            const pending = deferred<{ invoice: { id: string } }>();
            const wrapper = mountComponent();
            await flushPromises();

            mockGetInvoicePreview.mockReturnValueOnce(pending.promise);
            await choose(wrapper, ['pri_5000']);

            expect(isDisabled(wrapper)).toBe(true);

            pending.resolve({ invoice: { id: 'invo_5000' } });
            await flushPromises();

            expect(isDisabled(wrapper)).toBe(false);
        });

        it('is disabled again once the selection is reverted to what the schedule has', async () => {
            const wrapper = mountComponent();
            await flushPromises();

            await choose(wrapper, ['pri_5000']);
            expect(isDisabled(wrapper)).toBe(false);

            await choose(wrapper, ['pri_1000']);
            expect(isDisabled(wrapper)).toBe(true);
        });

        it('is disabled when the change cannot be priced, and says so', async () => {
            const wrapper = mountComponent();
            await flushPromises();

            mockGetInvoicePreview.mockRejectedValueOnce(new Error('400'));
            await choose(wrapper, ['pri_5000']);

            expect(isDisabled(wrapper)).toBe(true);
            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementSummary' }).props('hasError'),
            ).toBe(true);
        });

        it('does not let a slow preview of an earlier choice enable the current one', async () => {
            const slow = deferred<{ invoice: { id: string } }>();
            const current = deferred<{ invoice: { id: string } }>();
            const wrapper = mountComponent();
            await flushPromises();

            mockGetInvoicePreview.mockReturnValueOnce(slow.promise);
            await choose(wrapper, ['pri_5000']);
            mockGetInvoicePreview.mockReturnValueOnce(current.promise);
            await choose(wrapper, ['pri_1000', 'pri_5000']);

            slow.resolve({ invoice: { id: 'invo_stale' } });
            await flushPromises();

            expect(isDisabled(wrapper)).toBe(true);
        });

        it('commits once when the form is submitted twice in a row', async () => {
            mockCreatePricingPlanSchedule.mockReturnValue(new Promise(() => {}));
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            const formElement = wrapper.find('.sv-subscription-management__form');
            await formElement.trigger('submit');
            await formElement.trigger('submit');
            await flushPromises();

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalledTimes(1);
        });

        it('commits through the aside button, which names the form', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            const button = wrapper.find('.sv-subscription-management__update');
            expect(button.attributes('type')).toBe('submit');
            expect(button.attributes('form')).toBe(
                wrapper.find('.sv-subscription-management__form').attributes('id'),
            );
        });
    });

    describe('schedules', () => {
        it('prices and opens on the running schedule when a future one is already scheduled', async () => {
            const future = {
                ...activeScheduleInfo,
                id: 'ppsc_future',
                start_at: '2026-09-01T00:00:00.000Z',
                pricing_plan_schedule: {
                    ...activeScheduleInfo.pricing_plan_schedule,
                    id: 'ppsc_future',
                    start_at: '2026-09-01T00:00:00.000Z',
                    enabled_pricings: [{ pricing_id: 'pri_support_plus' }],
                },
                pricing_plan_version: { pricing_categories: [{ pricing_groups: [supportGroup] }] },
            };

            const wrapper = mountComponent({
                sub: {
                    ...subscription,
                    pricing_plan_schedule_infos: [activeScheduleInfo, future],
                } as unknown as PricingPlanSubscriptionExpanded,
            });
            await flushPromises();

            expect(form(wrapper).props('pricingGroup')).toEqual(
                expect.objectContaining({ id: 'pgr_credits' }),
            );
            expect(mockGetInvoicePreview).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    customizations: [
                        expect.objectContaining({ pricing_plan_schedule_id: 'ppsc_active' }),
                    ],
                }),
            );
        });
    });

    describe('customized pricings', () => {
        /**
         * The portal schedule endpoint builds the new schedule from `enabled_pricings` alone and
         * copies no `override_pricings` (PortalPricingPlanScheduleService.createPricingPlanSchedule),
         * and refuses the original of an override as enabled (EnabledPricingsValidator). Any change,
         * to whichever group, would drop the customized credit pack, so none is priced or committed.
         */
        it('does not commit a change that drops a customized pricing of another group', async () => {
            const wrapper = mountComponent({
                sub: customizedSubscription,
                enabledPricingId: 'pri_support_plus',
            });
            await flushPromises();

            await wrapper.find('.sv-subscription-management__update').trigger('click');
            await flushPromises();

            // The form, and with it any way to submit a choice, is replaced by the explanation.
            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);

            const sent = mockCreatePricingPlanSchedule.mock.calls.map(
                ([payload]) => payload.enabledPricings as { pricing_id: string }[],
            );

            // Nothing is committed, so nothing is dropped: no payload goes out without the pack.
            expect(sent).toEqual([]);
            expect(isDisabled(wrapper)).toBe(true);
            expect(wrapper.find('.sv-subscription-management__customized-pricing').exists()).toBe(
                true,
            );
        });

        it('does not price a change it cannot commit', async () => {
            mountComponent({ sub: customizedSubscription, enabledPricingId: 'pri_support_plus' });
            await flushPromises();

            expect(mockGetInvoicePreview).not.toHaveBeenCalled();
        });

        it('says why the update cannot be made, on the button itself', async () => {
            const wrapper = mountComponent({ sub: customizedSubscription });
            await flushPromises();

            const describedBy = wrapper
                .find('.sv-subscription-management__update')
                .attributes('aria-describedby');

            expect(describedBy).toBeDefined();
            expect(wrapper.find(`#${describedBy}`).exists()).toBe(true);
        });
    });

    describe('payment method', () => {
        /**
         * The API only accepts a change when the subscription's method is ACTIVE
         * (PortalPricingPlanScheduleService.validatePaymentMethod), so an INACTIVE one is not
         * offered.
         */
        it('cannot be committed when the subscription method is not active', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [
                    {
                        id: 'pm_saved',
                        status: 'INACTIVE',
                        type: 'CARD',
                    } as unknown as PaymentMethod,
                ],
            });
            await flushPromises();

            expect(isDisabled(wrapper)).toBe(true);
        });
    });

    describe('round 2: the customized-pricing guard', () => {
        const withSchedule = (schedule: Record<string, unknown>, version?: unknown) =>
            ({
                ...subscription,
                pricing_plan_schedule_infos: [
                    {
                        ...activeScheduleInfo,
                        pricing_plan_schedule: {
                            ...activeScheduleInfo.pricing_plan_schedule,
                            ...schedule,
                        },
                        ...(version !== undefined && { pricing_plan_version: version }),
                    },
                ],
            }) as unknown as PricingPlanSubscriptionExpanded;

        it('does not lock a schedule whose override list is empty', async () => {
            const wrapper = mountComponent({
                sub: withSchedule({ override_pricings: [] }),
                enabledPricingId: 'pri_5000',
            });
            await flushPromises();

            expect(wrapper.find('.sv-subscription-management__customized-pricing').exists()).toBe(
                false,
            );
            expect(mockGetInvoicePreview).toHaveBeenCalled();
            expect(isDisabled(wrapper)).toBe(false);
        });

        // A new portal schedule carries no override at all, so a customized base fee is dropped by
        // a change to any group just the same.
        it('locks a schedule whose only customization sits outside every group', async () => {
            const wrapper = mountComponent({
                sub: withSchedule(
                    {
                        override_pricings: [
                            { id: 'pri_base_custom', original_pricing_id: 'pri_base' },
                        ],
                    },
                    {
                        pricing_categories: [
                            { pricings: [{ id: 'pri_base' }], pricing_groups: [creditsGroup] },
                        ],
                    },
                ),
                enabledPricingId: 'pri_5000',
            });
            await flushPromises();

            expect(wrapper.find('.sv-subscription-management__customized-pricing').exists()).toBe(
                true,
            );
            expect(mockGetInvoicePreview).not.toHaveBeenCalled();
            expect(isDisabled(wrapper)).toBe(true);
        });

        /**
         * DEFECT (minor, DD-3544 tester r2): with customized pricing but no group to manage, the
         * screen renders "Nothing to change", yet the Update button's aria-describedby still names
         * the custom-pricing message, which is not rendered (`submitButtonAttrs` vs the
         * `pricingGroup && isCustomized` branch in SubscriptionManagement.vue).
         */
        it('only points the button at a message that is on screen', async () => {
            const wrapper = mountComponent({
                sub: withSchedule(
                    {
                        enabled_pricings: [],
                        override_pricings: [
                            { id: 'pri_base_custom', original_pricing_id: 'pri_base' },
                        ],
                    },
                    { pricing_categories: [{ pricings: [{ id: 'pri_base' }] }] },
                ),
            });
            await flushPromises();

            const describedBy = wrapper
                .find('.sv-subscription-management__update')
                .attributes('aria-describedby');

            if (describedBy) {
                expect(wrapper.find(`#${describedBy}`).exists()).toBe(true);
            }
        });
    });

    describe('round 2: chargeable payment methods', () => {
        it.each(['BUY_NOW_PAY_LATER', 'CARD', 'DIGITAL_WALLET', 'DIRECT_DEBIT', 'ONLINE_BANKING'])(
            'offers an active %s method',
            async (type) => {
                const wrapper = mountComponent({
                    enabledPricingId: 'pri_5000',
                    paymentMethods: [{ ...activeMethod, type } as unknown as PaymentMethod],
                });
                await flushPromises();

                expect(form(wrapper).props('paymentMethods')).toHaveLength(1);
                expect(isDisabled(wrapper)).toBe(false);
            },
        );

        it.each([
            ['a PREPAID method', { type: 'PREPAID' }],
            ['an UNKNOWN method', { type: 'UNKNOWN' }],
            ['a method still in SETUP', { status: 'SETUP' }],
            ['an ARCHIVED method', { status: 'ARCHIVED' }],
            ["another customer's method", { customer_id: 'cus_other' }],
        ])('does not offer %s', async (_label, patch) => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                sub: { ...subscription, customer_id: 'cus_1' } as PricingPlanSubscriptionExpanded,
                paymentMethods: [
                    { ...activeMethod, customer_id: 'cus_1', ...patch } as unknown as PaymentMethod,
                ],
            });
            await flushPromises();

            expect(form(wrapper).props('paymentMethods')).toEqual([]);
            expect(isDisabled(wrapper)).toBe(true);
        });
    });
});
