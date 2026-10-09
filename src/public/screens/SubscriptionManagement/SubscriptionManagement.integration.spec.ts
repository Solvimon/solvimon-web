import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref, type Ref } from 'vue';
import type { PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import SubscriptionManagement from './SubscriptionManagement.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

const {
    mockUseSubscription,
    mockUseLoadInitialData,
    mockUsePaymentMethods,
    mockUseUpgradePreview,
    mockLoadPreview,
    mockGet,
    mockFetchAll,
    mockDispatchAction,
    mockCreatePricingPlanSchedule,
    mockChangeSubscriptionPlan,
    mockUsePlanGroup,
    mockLoadPlanGroup,
} = vi.hoisted(() => ({
    mockUseSubscription: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockUsePaymentMethods: vi.fn(),
    mockUseUpgradePreview: vi.fn(),
    mockLoadPreview: vi.fn(),
    mockGet: vi.fn(),
    mockFetchAll: vi.fn(),
    mockDispatchAction: vi.fn(),
    mockCreatePricingPlanSchedule: vi.fn(),
    mockChangeSubscriptionPlan: vi.fn(),
    mockUsePlanGroup: vi.fn(),
    mockLoadPlanGroup: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({ changeSubscriptionPlan: mockChangeSubscriptionPlan }),
}));

vi.mock('@/composables/useSubscriptionPlanGroup', () => ({
    useSubscriptionPlanGroup: mockUsePlanGroup,
}));

vi.mock('@/services/pricingPlanSchedules', () => ({
    createPricingPlanSchedulesService: () => ({
        createPricingPlanSchedule: mockCreatePricingPlanSchedule,
    }),
}));

vi.mock('@/composables/usePaymentMethodOptions', () => ({
    usePaymentMethodOptions: () => ({ paymentMethodOptions: ref([]), get: vi.fn() }),
}));

vi.mock('@/composables/useSubscriptionUpgradePreview', () => ({
    useSubscriptionUpgradePreview: mockUseUpgradePreview,
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
        useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
    };
});

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: mockUsePaymentMethods,
}));

// The real form reaches into solvimon-ui internals that resolve their own providers; its own spec
// covers what it renders, so here it only has to stand in for the wiring.
vi.mock('@/components/subscriptions/SubscriptionManagement/SubscriptionManagementForm.vue', () => ({
    default: defineComponent({
        name: 'SubscriptionManagementForm',
        props: {
            pricingGroup: { type: Object, default: undefined },
            planOptions: { type: Array, default: () => [] },
            paymentMethods: { type: Array, default: () => [] },
            billingPeriod: { type: Object, required: true },
            enabledPricingIds: { type: Array, required: true },
            paymentMethodId: String,
            pricingPlanId: String,
            disabled: Boolean,
        },
        emits: [
            'submit',
            'update:enabledPricingIds',
            'update:paymentMethodId',
            'update:pricingPlanId',
        ],
        // The real form opens on a payment method of its own accord, which the screen leans on.
        setup: (props, { emit }) => {
            onMounted(() => {
                const [first] = props.paymentMethods as { id: string }[];

                if (first) {
                    emit('update:paymentMethodId', first.id);
                }
            });

            // A real form, so the screen's submit button reaches it through its `form` attribute.
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

// Renders the previewed invoice through solvimon-ui internals that resolve their own providers; its
// own spec covers that.
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
        // Resolves its own IntlProvider internally, which is not mounted here.
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

const mockSubscription = {
    id: 'ppsu_1',
    customer_id: 'cus_123',
    payment_method_id: 'pm_saved',
    pricing_plan_schedule_infos: [
        {
            id: 'ppsc_active',
            pricing_plan_version_id: 'ppve_1',
            start_at: '2026-01-01T00:00:00.000Z',
            pricing_plan_schedule: {
                type: 'DEFAULT',
                billing_period: { type: 'MONTH', value: 1 },
                enabled_pricings: [{ pricing_id: 'pri_1000' }],
            },
            pricing_plan_version: {
                pricing_categories: [
                    {
                        pricing_groups: [
                            {
                                id: 'pgr_credits',
                                name: 'Credit packs',
                                pricings: [{ id: 'pri_1000' }, { id: 'pri_5000' }],
                            },
                        ],
                    },
                ],
            },
        },
    ],
} as unknown as PricingPlanSubscriptionExpanded;

/** Everything it has enabled sits straight on a category, so no group can be derived from it. */
const subscriptionWithoutGroups = {
    ...mockSubscription,
    pricing_plan_schedule_infos: [
        {
            ...mockSubscription.pricing_plan_schedule_infos[0],
            pricing_plan_version: { pricing_categories: [{ pricings: [{ id: 'pri_1000' }] }] },
        },
    ],
} as unknown as PricingPlanSubscriptionExpanded;

/** The screen only commits a change once something pays for it, so most cases start with one. */
const savedPaymentMethod = {
    id: 'pm_saved',
    status: 'ACTIVE',
    type: 'CARD',
    customer_id: 'cus_123',
} as unknown as PaymentMethod;

const planOptions: SubscriptionPlanOption[] = [
    { pricingPlanId: 'ppla_starter', name: 'Starter', order: 1, isCurrent: true },
    {
        pricingPlanId: 'ppla_pro',
        name: 'Pro',
        order: 2,
        isCurrent: false,
        direction: 'UPGRADE',
        changeType: 'IMMEDIATE_PRO_RATA',
    },
];

const mountComponent = ({
    enabledPricingId,
    subscription = mockSubscription,
    paymentMethods = [savedPaymentMethod],
    isLoading = false,
    extraEnabledPricingIds = [] as string[],
    subscriptionError = null,
    preview = {},
    planGroupOptions = [] as SubscriptionPlanOption[],
}: {
    enabledPricingId?: string;
    paymentMethods?: PaymentMethod[];
    isLoading?: boolean;
    extraEnabledPricingIds?: string[];
    subscriptionError?: Error | null;
    preview?: { invoice?: Ref<unknown>; isPending?: Ref<boolean>; error?: Ref<unknown> };
    /** The plans the subscription may move to. Empty for a plan that belongs to no group. */
    planGroupOptions?: SubscriptionPlanOption[];
    /** `null` stands for "not loaded yet" — `undefined` would fall back to the default. */
    subscription?: PricingPlanSubscriptionExpanded | null;
} = {}) => {
    const withExtras =
        subscription && extraEnabledPricingIds.length
            ? ({
                  ...subscription,
                  pricing_plan_schedule_infos: subscription.pricing_plan_schedule_infos.map(
                      (info) => ({
                          ...info,
                          pricing_plan_schedule: {
                              ...info.pricing_plan_schedule,
                              enabled_pricings: [
                                  ...extraEnabledPricingIds.map((pricingId) => ({
                                      pricing_id: pricingId,
                                  })),
                                  ...(info.pricing_plan_schedule.enabled_pricings ?? []),
                              ],
                          },
                      }),
                  ),
              } as unknown as PricingPlanSubscriptionExpanded)
            : subscription;

    mockUseSubscription.mockReturnValue({
        subscription: ref(withExtras ?? undefined),
        get: mockGet,
        error: ref(subscriptionError),
    });
    mockUsePaymentMethods.mockReturnValue({ items: ref(paymentMethods), fetchAll: mockFetchAll });
    mockUseUpgradePreview.mockReturnValue({
        invoice: preview.invoice ?? ref({ id: 'invo_preview' }),
        isPending: preview.isPending ?? ref(false),
        error: preview.error ?? ref(undefined),
        load: mockLoadPreview,
    });
    mockUsePlanGroup.mockReturnValue({
        group: ref(planGroupOptions.length ? { id: 'ppgr_1', name: 'Workspace plans' } : undefined),
        options: ref(planGroupOptions),
        currentPricingPlanId: ref(
            planGroupOptions.find(({ isCurrent }) => isCurrent)?.pricingPlanId,
        ),
        isPending: ref(false),
        error: ref(undefined),
        load: mockLoadPlanGroup,
    });
    mockUseLoadInitialData.mockReturnValue({ isLoading: ref(isLoading) });

    return mount(SubscriptionManagement, {
        props: { configuration: { subscriptionId: 'ppsu_1', enabledPricingId } },
        // Attached, so the submit button finds the form it names by id.
        attachTo: document.body,
    });
};

enableAutoUnmount(afterEach);

describe('SubscriptionManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreatePricingPlanSchedule.mockResolvedValue({ id: 'ppsc_new' });
        mockChangeSubscriptionPlan.mockResolvedValue({ id: 'ppsc_plan_change' });
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fetches the subscription named in the configuration', () => {
        mountComponent();

        expect(mockUseSubscription).toHaveBeenCalledWith({ subscriptionId: 'ppsu_1' });
    });

    it('fetches the payment methods of the portal customer', () => {
        mountComponent();

        expect(mockUsePaymentMethods).toHaveBeenCalledWith({
            customerId: createTestPortalObject().customer_id,
        });
    });

    describe('title', () => {
        it('names the group the enabled pricing was chosen from', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage Credit packs',
            );
        });

        it('names the group of what the schedule has enabled when the host names no pricing', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage Credit packs',
            );
        });

        it('falls back to the generic title when nothing enabled belongs to a group', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithoutGroups });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage subscription',
            );
        });

        it('falls back when the pricing belongs to no group on the active schedule', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_unknown' });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage subscription',
            );
        });

        it('falls back while the subscription is still loading', () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_1000',
                subscription: null,
            });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage subscription',
            );
        });

        it('ignores groups on a schedule that is not the active one', () => {
            const endedSchedule = {
                ...mockSubscription,
                pricing_plan_schedule_infos: [
                    {
                        ...mockSubscription.pricing_plan_schedule_infos[0],
                        end_at: '2026-02-01T00:00:00.000Z',
                    },
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const wrapper = mountComponent({
                enabledPricingId: 'pri_1000',
                subscription: endedSchedule,
            });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage subscription',
            );
        });
    });

    describe('form', () => {
        it('renders the form for the group being changed', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(true);
        });

        it('renders the group of what the schedule has enabled when the host names no pricing', () => {
            const wrapper = mountComponent();

            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementForm' }).props('pricingGroup'),
            ).toEqual(expect.objectContaining({ id: 'pgr_credits' }));
        });

        it('renders no form when there is no group to change', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithoutGroups });

            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
        });

        it('starts the form on the pricings the schedule already has enabled', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementForm' })
                    .props('enabledPricingIds'),
            ).toEqual(['pri_1000']);
        });

        it('shows a skeleton while the initial data loads', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000', isLoading: true });

            expect(wrapper.find('.sv-skeleton').exists()).toBe(true);
            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
        });
    });

    describe('summary', () => {
        it('renders the order summary in the aside', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(true);
        });

        it('previews what the pricings enabled on the schedule would be invoiced for', () => {
            mountComponent({ enabledPricingId: 'pri_1000' });

            expect(mockLoadPreview).toHaveBeenCalledWith(
                expect.objectContaining({ enabledPricingIds: ['pri_1000'] }),
            );
        });

        it('previews on the schedule being billed now, not on one that has ended', () => {
            const [active] = mockSubscription.pricing_plan_schedule_infos;

            mountComponent({
                subscription: {
                    ...mockSubscription,
                    pricing_plan_schedule_infos: [
                        {
                            ...active,
                            id: 'ppsc_ended',
                            start_at: '2025-01-01T00:00:00.000Z',
                            end_at: '2026-01-01T00:00:00.000Z',
                        },
                        active,
                    ],
                } as unknown as PricingPlanSubscriptionExpanded,
            });

            expect(mockLoadPreview).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduleInfo: expect.objectContaining({ id: 'ppsc_active' }),
                }),
            );
        });

        it('does not preview while there is nothing enabled to price', () => {
            mountComponent({ subscription: null });

            expect(mockLoadPreview).not.toHaveBeenCalled();
        });
    });

    describe('preselection', () => {
        it('opens on the pricing the host named, not the one the schedule has', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementForm' })
                    .props('enabledPricingIds'),
            ).toEqual(['pri_5000']);
        });

        it('keeps the pricings enabled for the groups it is not managing', () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                extraEnabledPricingIds: ['pri_other_group'],
            });

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementForm' })
                    .props('enabledPricingIds'),
            ).toEqual(['pri_other_group', 'pri_5000']);
        });

        it('falls back to the schedule when the named pricing is not in the group', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementForm' })
                    .props('enabledPricingIds'),
            ).toEqual(['pri_1000']);
        });
    });

    describe('payment method', () => {
        const methodsOffered = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.findComponent({ name: 'SubscriptionManagementForm' }).props('paymentMethods');

        it("offers only the subscription's own method, since that is what the API charges", () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [{ ...savedPaymentMethod, id: 'pm_other' }, savedPaymentMethod],
            });

            expect(methodsOffered(wrapper)).toEqual([savedPaymentMethod]);
        });

        it.each([
            ['is not active', { status: 'INACTIVE' }],
            ['is still being set up', { status: 'SETUP' }],
            ['is prepaid', { type: 'PREPAID' }],
            ['is of an unknown type', { type: 'UNKNOWN' }],
            ['belongs to another customer', { customer_id: 'cus_other' }],
        ])('offers nothing when the method %s, since the API refuses it', async (_, change) => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [{ ...savedPaymentMethod, ...change } as unknown as PaymentMethod],
            });
            await flushPromises();

            expect(methodsOffered(wrapper)).toEqual([]);
            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeDefined();
        });

        it('cannot be committed when the subscription has no method among the saved ones', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [{ ...savedPaymentMethod, id: 'pm_other' }],
            });
            await flushPromises();

            const button = wrapper.find('.sv-subscription-management__update');

            expect(button.attributes('disabled')).toBeDefined();
            expect(button.attributes('aria-describedby')).toBe(
                'sv-subscription-management-form__no-payment-method',
            );
        });

        it('describes the button by nothing while the message is not on screen yet', () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [],
                isLoading: true,
            });

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('aria-describedby'),
            ).toBeUndefined();
        });

        it('describes the button by nothing while there is a method', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('aria-describedby'),
            ).toBeUndefined();
        });
    });

    describe('loading', () => {
        it('reports a subscription that cannot be loaded in place of the form', () => {
            const wrapper = mountComponent({
                subscription: null,
                subscriptionError: new Error('nope'),
            });

            expect(wrapper.find('.sv-subscription-management__load-error').exists()).toBe(true);
            expect(wrapper.find('.sv-subscription-management__empty-state').exists()).toBe(false);
        });

        it('says there is nothing to change when no group can be changed', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithoutGroups });

            expect(wrapper.find('.sv-subscription-management__empty-state').exists()).toBe(true);
        });

        it('says there is nothing to change when no schedule is running', () => {
            const wrapper = mountComponent({
                subscription: {
                    ...mockSubscription,
                    pricing_plan_schedule_infos: [
                        {
                            ...mockSubscription.pricing_plan_schedule_infos[0],
                            end_at: '2026-02-01T00:00:00.000Z',
                        },
                    ],
                } as unknown as PricingPlanSubscriptionExpanded,
            });

            expect(wrapper.find('.sv-subscription-management__empty-state').exists()).toBe(true);
            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
        });
    });

    describe('customized pricings', () => {
        /** The enabled pricing has been customized for this subscription, under an id of its own. */
        const customizedSubscription = {
            ...mockSubscription,
            pricing_plan_schedule_infos: [
                {
                    ...mockSubscription.pricing_plan_schedule_infos[0],
                    pricing_plan_schedule: {
                        ...mockSubscription.pricing_plan_schedule_infos[0].pricing_plan_schedule,
                        enabled_pricings: [],
                        override_pricings: [
                            { id: 'pri_1000_custom', original_pricing_id: 'pri_1000' },
                        ],
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        it('names the group of a customized pricing', () => {
            const wrapper = mountComponent({
                subscription: customizedSubscription,
                enabledPricingId: 'pri_1000_custom',
            });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage Credit packs',
            );
        });

        it('says it cannot be changed here, in place of a form that would drop it', () => {
            const wrapper = mountComponent({ subscription: customizedSubscription });

            expect(wrapper.find('.sv-subscription-management__customized-pricing').exists()).toBe(
                true,
            );
            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(false);
        });

        it('neither prices nor commits a change', async () => {
            const wrapper = mountComponent({
                subscription: customizedSubscription,
                enabledPricingId: 'pri_5000',
            });
            await flushPromises();

            await wrapper.find('.sv-subscription-management__update').trigger('click');
            await flushPromises();

            expect(mockLoadPreview).not.toHaveBeenCalled();
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
            expect(
                wrapper.find('.sv-subscription-management__update').attributes('aria-describedby'),
            ).toBe('sv-subscription-management__customized-pricing-message');
        });
    });

    describe('updating the subscription', () => {
        const update = async (wrapper: ReturnType<typeof mountComponent>) => {
            // The form picks a payment method as it mounts, which only enables the button a tick later.
            await flushPromises();
            await wrapper.find('.sv-subscription-management__update').trigger('click');
            await flushPromises();

            return wrapper;
        };

        const isDisabled = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.find('.sv-subscription-management__update').attributes('disabled') !==
            undefined;

        it('starts a new schedule with the pricings that are selected', async () => {
            await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalledWith({
                pricingPlanSubscriptionId: 'ppsu_1',
                enabledPricings: [{ pricing_id: 'pri_5000' }],
            });
        });

        it('commits when the form is submitted, as Enter in it does', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            await wrapper.find('.sv-subscription-management__form').trigger('submit');
            await flushPromises();

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalledTimes(1);
        });

        it('sends the pricings of the groups it is not changing along too', async () => {
            await update(
                mountComponent({
                    enabledPricingId: 'pri_5000',
                    extraEnabledPricingIds: ['pri_other_group'],
                }),
            );

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalledWith(
                expect.objectContaining({
                    enabledPricings: [
                        { pricing_id: 'pri_other_group' },
                        { pricing_id: 'pri_5000' },
                    ],
                }),
            );
        });

        it('confirms the change once it is committed, naming what was changed', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementSuccess' })
                    .props('pricingGroupName'),
            ).toBe('Credit packs');
        });

        it('stops offering the change once it is committed', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(false);
            expect(wrapper.find('.sv-subscription-management__update').exists()).toBe(false);
        });

        it('stays put until the customer is done reading the confirmation', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(mockDispatchAction).not.toHaveBeenCalled();

            await wrapper.find('.sv-subscription-management__done').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'navigate-to-customer-overview',
            });
        });

        it('reports a failure and stays put', async () => {
            mockCreatePricingPlanSchedule.mockRejectedValue(new Error('nope'));

            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(wrapper.find('.sv-subscription-management__update-error').exists()).toBe(true);
            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('locks the form while the change is being committed', async () => {
            mockCreatePricingPlanSchedule.mockReturnValue(new Promise(() => {}));

            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementForm' }).props('disabled'),
            ).toBe(true);
        });

        it('cannot be submitted while the initial data is still loading', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000', isLoading: true });

            expect(isDisabled(wrapper)).toBe(true);
        });

        it('cannot be submitted until something pays for the change', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000', paymentMethods: [] });
            await flushPromises();

            expect(isDisabled(wrapper)).toBe(true);
        });

        it('can be submitted once a change is priced and a payment method is selected', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            expect(isDisabled(wrapper)).toBe(false);
        });

        it('cannot be submitted while nothing has changed, so no duplicate schedule starts', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_1000' }));

            expect(isDisabled(wrapper)).toBe(true);
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('cannot be submitted while the change is still being priced', async () => {
            const wrapper = await update(
                mountComponent({ enabledPricingId: 'pri_5000', preview: { isPending: ref(true) } }),
            );

            expect(isDisabled(wrapper)).toBe(true);
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('cannot be submitted when the change could not be priced', async () => {
            const wrapper = await update(
                mountComponent({
                    enabledPricingId: 'pri_5000',
                    preview: { invoice: ref(undefined), error: ref(new Error('nope')) },
                }),
            );

            expect(isDisabled(wrapper)).toBe(true);
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('cannot be submitted when there is no group to change', async () => {
            const wrapper = await update(
                mountComponent({ subscription: subscriptionWithoutGroups }),
            );

            expect(isDisabled(wrapper)).toBe(true);
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('does not commit anything while no payment method is selected', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000', paymentMethods: [] });

            await update(wrapper);

            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('renders the secure payments KPI below it', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__kpi').exists()).toBe(true);
        });
    });

    describe('changing plan', () => {
        const pickPlan = async (
            wrapper: ReturnType<typeof mountComponent>,
            pricingPlanId: string,
        ) => {
            wrapper
                .findComponent({ name: 'SubscriptionManagementForm' })
                .vm.$emit('update:pricingPlanId', pricingPlanId);
            await flushPromises();

            return wrapper;
        };

        const update = async (wrapper: ReturnType<typeof mountComponent>) => {
            await wrapper.find('.sv-subscription-management__update').trigger('click');
            await flushPromises();

            return wrapper;
        };

        it('asks the subscription for the group its active schedule runs in', () => {
            mountComponent({ planGroupOptions: planOptions });

            expect(mockLoadPlanGroup).toHaveBeenCalledWith({
                subscriptionId: 'ppsu_1',
                scheduleInfo: expect.objectContaining({ id: 'ppsc_active' }),
            });
        });

        it('hands the form the plans the subscription may move to', () => {
            const wrapper = mountComponent({ planGroupOptions: planOptions });
            const form = wrapper.findComponent({ name: 'SubscriptionManagementForm' });

            expect(form.props('planOptions')).toEqual(planOptions);
        });

        it('opens on the plan the subscription runs on today', () => {
            const wrapper = mountComponent({ planGroupOptions: planOptions });

            expect(
                wrapper
                    .findComponent({ name: 'SubscriptionManagementForm' })
                    .props('pricingPlanId'),
            ).toBe('ppla_starter');
        });

        it('renders the form for a plan group even when there is no pricing group to change', () => {
            const wrapper = mountComponent({
                subscription: subscriptionWithoutGroups,
                planGroupOptions: planOptions,
            });

            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(true);
        });

        it('explains the move instead of pricing it, since a plan change is not previewed', async () => {
            const wrapper = await pickPlan(
                mountComponent({ planGroupOptions: planOptions }),
                'ppla_pro',
            );

            expect(wrapper.find('.sv-subscription-management__plan-change-summary').exists()).toBe(
                true,
            );
            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(false);
        });

        it('keeps pricing the pricings while the current plan is kept', () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_1000',
                planGroupOptions: planOptions,
            });

            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(true);
            expect(mockLoadPreview).toHaveBeenCalled();
        });

        it('stops previewing once another plan is picked', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_1000',
                planGroupOptions: planOptions,
            });
            mockLoadPreview.mockClear();

            await pickPlan(wrapper, 'ppla_pro');

            expect(mockLoadPreview).not.toHaveBeenCalled();
        });

        it('moves the subscription to the plan that was picked', async () => {
            const wrapper = await pickPlan(
                mountComponent({ enabledPricingId: 'pri_1000', planGroupOptions: planOptions }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('commits a move without waiting for a price, since a plan change is not previewed', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    enabledPricingId: 'pri_1000',
                    planGroupOptions: planOptions,
                    preview: { invoice: ref(undefined) },
                }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
        });

        it('starts a new schedule instead when the plan is left alone', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                planGroupOptions: planOptions,
            });
            await flushPromises();

            await update(wrapper);

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalled();
            expect(mockChangeSubscriptionPlan).not.toHaveBeenCalled();
        });

        it('confirms the move by naming the plan it landed on', async () => {
            const wrapper = await pickPlan(
                mountComponent({ enabledPricingId: 'pri_1000', planGroupOptions: planOptions }),
                'ppla_pro',
            );

            await update(wrapper);

            const success = wrapper.findComponent({ name: 'SubscriptionManagementSuccess' });

            expect(success.props('pricingPlanName')).toBe('Pro');
            expect(success.props('pricingGroupName')).toBeUndefined();
        });

        it('reports a failed move and stays put', async () => {
            mockChangeSubscriptionPlan.mockRejectedValue(new Error('nope'));

            const wrapper = await pickPlan(
                mountComponent({ enabledPricingId: 'pri_1000', planGroupOptions: planOptions }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(wrapper.find('.sv-subscription-management__update-error').exists()).toBe(true);
            expect(wrapper.find('.sv-subscription-management__success').exists()).toBe(false);
        });

        // Nothing is enabled to pay for, but the move itself is still something to commit.
        it('can be committed for a schedule with no pricings enabled at all', async () => {
            const withoutEnabledPricings = {
                ...mockSubscription,
                pricing_plan_schedule_infos: [
                    {
                        ...mockSubscription.pricing_plan_schedule_infos[0],
                        pricing_plan_schedule: {
                            ...mockSubscription.pricing_plan_schedule_infos[0]
                                .pricing_plan_schedule,
                            enabled_pricings: [],
                        },
                    },
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const wrapper = await pickPlan(
                mountComponent({
                    subscription: withoutEnabledPricings,
                    planGroupOptions: planOptions,
                }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
        });

        it('can be committed for a plan that has no pricings to enable', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    subscription: subscriptionWithoutGroups,
                    planGroupOptions: planOptions,
                }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
        });
    });
});
