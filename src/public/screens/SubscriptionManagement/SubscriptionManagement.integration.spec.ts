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
    mockUsePlanChangePreview,
    mockLoadPlanChangePreview,
    mockResetPlanChangePreview,
    mockGet,
    mockFetchCustomer,
    mockFetchAll,
    mockDispatchAction,
    mockCreatePricingPlanSchedule,
    mockChangeSubscriptionPlan,
    mockSetSubscriptionPaymentMethod,
    mockUsePlanGroup,
    mockLoadPlanGroup,
} = vi.hoisted(() => ({
    mockUseSubscription: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockUsePaymentMethods: vi.fn(),
    mockUseUpgradePreview: vi.fn(),
    mockLoadPreview: vi.fn(),
    mockUsePlanChangePreview: vi.fn(),
    mockLoadPlanChangePreview: vi.fn(),
    mockResetPlanChangePreview: vi.fn(),
    mockGet: vi.fn(),
    mockFetchCustomer: vi.fn(),
    mockFetchAll: vi.fn(),
    mockDispatchAction: vi.fn(),
    mockCreatePricingPlanSchedule: vi.fn(),
    mockChangeSubscriptionPlan: vi.fn(),
    mockSetSubscriptionPaymentMethod: vi.fn(),
    mockUsePlanGroup: vi.fn(),
    mockLoadPlanGroup: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({
        changeSubscriptionPlan: mockChangeSubscriptionPlan,
        setSubscriptionPaymentMethod: mockSetSubscriptionPaymentMethod,
    }),
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

vi.mock('@/composables/useCustomer', async () => {
    const { ref } = await import('vue');

    return {
        useCustomer: () => ({
            customer: ref({ id: 'cus_123', timezone: 'Europe/Amsterdam' }),
            get: { execute: mockFetchCustomer },
        }),
    };
});

// Stores the method through the payment gateway; its own spec covers that.
vi.mock('@/components/payments/AddPaymentMethodModal/AddPaymentMethodModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'AddPaymentMethodModal',
        props: { showModal: Boolean, customer: Object, subscription: Object, subTitle: String },
        emits: ['stored', 'failure', 'close'],
        setup: () => () => h('div', { class: 'sv-add-payment-method-modal-stub' }),
    }),
}));

// Confirms and carries out the cancellation itself; its own spec covers that. Loaded with
// `import()`, which only unwraps `default` from a module that says it is one.
vi.mock(
    '@/components/subscriptions/SubscriptionCancellationModal/SubscriptionCancellationModal.vue',
    () => ({
        __esModule: true,
        default: defineComponent({
            name: 'SubscriptionCancellationModal',
            props: {
                showModal: Boolean,
                variant: String,
                subscription: Object,
                customer: Object,
                paymentMethod: Object,
            },
            emits: ['confirmed', 'close'],
            setup: () => () => h('div', { class: 'sv-subscription-cancellation-modal-stub' }),
        }),
    }),
);

vi.mock('@/composables/useSubscriptionPlanChangePreview', () => ({
    useSubscriptionPlanChangePreview: mockUsePlanChangePreview,
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
            'add-payment-method',
        ],
        // The real form opens on a payment method of its own accord when the screen has not
        // picked one, which the screen leans on.
        setup: (props, { emit }) => {
            onMounted(() => {
                const [first] = props.paymentMethods as { id: string }[];

                if (first && !props.paymentMethodId) {
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
    planChangePreview = {},
    planGroupOptions = [] as SubscriptionPlanOption[],
}: {
    enabledPricingId?: string;
    paymentMethods?: PaymentMethod[];
    isLoading?: boolean;
    extraEnabledPricingIds?: string[];
    subscriptionError?: Error | null;
    preview?: { invoice?: Ref<unknown>; isPending?: Ref<boolean>; error?: Ref<unknown> };
    /** What the move to another plan is priced at. */
    planChangePreview?: {
        invoice?: Ref<unknown>;
        isPending?: Ref<boolean>;
        error?: Ref<unknown>;
    };
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
    mockUsePlanChangePreview.mockReturnValue({
        invoice: planChangePreview.invoice ?? ref({ id: 'invo_plan_change' }),
        isPending: planChangePreview.isPending ?? ref(false),
        error: planChangePreview.error ?? ref(undefined),
        load: mockLoadPlanChangePreview,
        reset: mockResetPlanChangePreview,
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
        // The screen manages the subscription as a whole, plans and pricings alike.
        it('is the same whichever group the enabled pricing was chosen from', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__title').text()).toBe(
                'Manage subscription',
            );
        });

        it('is there while the subscription is still loading', () => {
            const wrapper = mountComponent({ subscription: null });

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
        const otherPaymentMethod = { ...savedPaymentMethod, id: 'pm_other' } as PaymentMethod;

        const findForm = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.findComponent({ name: 'SubscriptionManagementForm' });

        const pickPaymentMethod = async (
            wrapper: ReturnType<typeof mountComponent>,
            paymentMethodId: string,
        ) => {
            findForm(wrapper).vm.$emit('update:paymentMethodId', paymentMethodId);
            await flushPromises();
        };

        const update = async (wrapper: ReturnType<typeof mountComponent>) => {
            await wrapper.find('.sv-subscription-management__update').trigger('click');
            await flushPromises();
        };

        it("offers every stored method the API can charge, not only the subscription's own", () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [otherPaymentMethod, savedPaymentMethod],
            });

            expect(findForm(wrapper).props('paymentMethods')).toEqual([
                otherPaymentMethod,
                savedPaymentMethod,
            ]);
        });

        it.each([
            ['is not active', { status: 'INACTIVE' }],
            ['is still being set up', { status: 'SETUP' }],
            ['is prepaid', { type: 'PREPAID' }],
            ['is of an unknown type', { type: 'UNKNOWN' }],
            ['belongs to another customer', { customer_id: 'cus_other' }],
        ])('leaves out a method that %s, since the API refuses it', async (_, change) => {
            const refused = { ...otherPaymentMethod, ...change } as unknown as PaymentMethod;
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [refused, savedPaymentMethod],
            });
            await flushPromises();

            expect(findForm(wrapper).props('paymentMethods')).toEqual([savedPaymentMethod]);
        });

        it("opens on the subscription's own method, whichever is listed first", async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [otherPaymentMethod, savedPaymentMethod],
            });
            await flushPromises();

            expect(findForm(wrapper).props('paymentMethodId')).toBe('pm_saved');
        });

        it('cannot be committed without a method the API can charge', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [{ ...savedPaymentMethod, status: 'INACTIVE' } as PaymentMethod],
            });
            await flushPromises();

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeDefined();
        });

        it("commits without linking anything while the subscription's own method is picked", async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            await update(wrapper);

            expect(mockSetSubscriptionPaymentMethod).not.toHaveBeenCalled();
            expect(mockCreatePricingPlanSchedule).toHaveBeenCalled();
        });

        // The API charges the change to the subscription's own method and takes no other.
        it('links another picked method to the subscription before committing', async () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [otherPaymentMethod, savedPaymentMethod],
            });
            await pickPaymentMethod(wrapper, 'pm_other');

            await update(wrapper);

            expect(mockSetSubscriptionPaymentMethod).toHaveBeenCalledWith({
                id: 'ppsu_1',
                paymentMethodId: 'pm_other',
            });
            expect(mockSetSubscriptionPaymentMethod.mock.invocationCallOrder[0]).toBeLessThan(
                mockCreatePricingPlanSchedule.mock.invocationCallOrder[0],
            );
        });

        it('commits nothing when the method cannot be linked, and says so', async () => {
            mockSetSubscriptionPaymentMethod.mockRejectedValue(new Error('nope'));
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                paymentMethods: [otherPaymentMethod, savedPaymentMethod],
            });
            await pickPaymentMethod(wrapper, 'pm_other');

            await update(wrapper);

            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
            expect(wrapper.find('.sv-subscription-management__update-error').exists()).toBe(true);
        });

        it('adds a method in a modal, for the customer it is stored for', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();

            findForm(wrapper).vm.$emit('add-payment-method');
            await flushPromises();

            const modal = wrapper.findComponent({ name: 'AddPaymentMethodModal' });
            expect(modal.props('showModal')).toBe(true);
            expect(modal.props('subscription')).toMatchObject({ id: 'ppsu_1' });
            expect(mockFetchCustomer).toHaveBeenCalledTimes(1);
        });

        it('reloads the methods once one is stored, so the form can select it', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_5000' });
            await flushPromises();
            findForm(wrapper).vm.$emit('add-payment-method');
            await flushPromises();
            mockFetchAll.mockClear();

            wrapper.findComponent({ name: 'AddPaymentMethodModal' }).vm.$emit('stored');
            await flushPromises();

            expect(mockFetchAll).toHaveBeenCalled();
            expect(wrapper.findComponent({ name: 'AddPaymentMethodModal' }).exists()).toBe(false);
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

        // Without the group the screen would have nothing to manage, and say so instead.
        it('finds the group of a customized pricing the host names', () => {
            const wrapper = mountComponent({
                subscription: customizedSubscription,
                enabledPricingId: 'pri_1000_custom',
            });

            expect(wrapper.find('.sv-subscription-management__customized-pricing').exists()).toBe(
                true,
            );
            expect(wrapper.find('.sv-subscription-management__empty-state').exists()).toBe(false);
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

        it('explains when the move lands and prices it in the order summary', async () => {
            const wrapper = await pickPlan(
                mountComponent({ planGroupOptions: planOptions }),
                'ppla_pro',
            );

            expect(wrapper.find('.sv-subscription-management__plan-change-summary').exists()).toBe(
                true,
            );
            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementSummary' }).props('invoice'),
            ).toEqual({ id: 'invo_plan_change' });
        });

        it('previews the move to the plan picked', async () => {
            await pickPlan(mountComponent({ planGroupOptions: planOptions }), 'ppla_pro');

            expect(mockLoadPlanChangePreview).toHaveBeenCalledWith({
                subscriptionId: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
        });

        it('does not preview a move while the current plan is kept', () => {
            mountComponent({ planGroupOptions: planOptions });

            expect(mockLoadPlanChangePreview).not.toHaveBeenCalled();
        });

        it('drops the price of the move once the customer is back on their own plan', async () => {
            const wrapper = await pickPlan(
                mountComponent({ planGroupOptions: planOptions }),
                'ppla_pro',
            );
            mockResetPlanChangePreview.mockClear();

            await pickPlan(wrapper, 'ppla_starter');

            expect(mockResetPlanChangePreview).toHaveBeenCalled();
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

        it('offers to upgrade the plan when the plan picked is higher in the group', async () => {
            const wrapper = await pickPlan(
                mountComponent({ planGroupOptions: planOptions }),
                'ppla_pro',
            );

            expect(wrapper.find('.sv-subscription-management__update').text()).toBe('Upgrade plan');
        });

        it('offers to downgrade the plan when the plan picked is lower in the group', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    planGroupOptions: [
                        {
                            pricingPlanId: 'ppla_free',
                            name: 'Free',
                            order: 0,
                            isCurrent: false,
                            direction: 'DOWNGRADE',
                            changeType: 'NEXT_BILLING_PERIOD',
                        },
                        ...planOptions,
                    ],
                }),
                'ppla_free',
            );

            expect(wrapper.find('.sv-subscription-management__update').text()).toBe(
                'Downgrade plan',
            );
        });

        it('says the plan selected is the current one while nothing is changed', () => {
            const wrapper = mountComponent({ planGroupOptions: planOptions });

            expect(wrapper.find('.sv-subscription-management__update').text()).toBe(
                'Your current plan',
            );
        });

        it('offers to update the subscription once a pricing on the current plan is changed', () => {
            const wrapper = mountComponent({
                enabledPricingId: 'pri_5000',
                planGroupOptions: planOptions,
            });

            expect(wrapper.find('.sv-subscription-management__update').text()).toBe(
                'Update subscription',
            );
        });

        it('offers to update the subscription for a plan with no others to move to', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-management__update').text()).toBe(
                'Update subscription',
            );
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

        it('commits a move on its own price, whatever the pricings on this plan cost', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    enabledPricingId: 'pri_1000',
                    planGroupOptions: planOptions,
                    preview: { invoice: ref(undefined), error: ref(new Error('not priced')) },
                }),
                'ppla_pro',
            );

            await update(wrapper);

            expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
            });
        });

        it('does not commit a move before its price has loaded', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    planGroupOptions: planOptions,
                    planChangePreview: { invoice: ref(undefined), isPending: ref(true) },
                }),
                'ppla_pro',
            );

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeDefined();
            await update(wrapper);
            expect(mockChangeSubscriptionPlan).not.toHaveBeenCalled();
        });

        it('does not commit a move whose price could not be loaded', async () => {
            const wrapper = await pickPlan(
                mountComponent({
                    planGroupOptions: planOptions,
                    planChangePreview: { invoice: ref(undefined), error: ref(new Error('nope')) },
                }),
                'ppla_pro',
            );

            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementSummary' }).props('hasError'),
            ).toBe(true);
            await update(wrapper);
            expect(mockChangeSubscriptionPlan).not.toHaveBeenCalled();
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

    describe('cancelling', () => {
        const runningSubscription = {
            ...mockSubscription,
            status: 'ACTIVE',
            type: 'BILLING',
        } as unknown as PricingPlanSubscriptionExpanded;

        const cancelledSubscription = {
            ...runningSubscription,
            inactive_periods: [{ type: 'CANCEL', start_at: '2099-05-01T00:00:00.000Z' }],
        } as unknown as PricingPlanSubscriptionExpanded;

        const findModal = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.findComponent({ name: 'SubscriptionCancellationModal' });

        it('offers to cancel a running subscription', () => {
            const wrapper = mountComponent({ subscription: runningSubscription });

            expect(wrapper.find('.sv-subscription-management__cancel').text()).toBe(
                'Cancel subscription',
            );
            expect(wrapper.find('.sv-subscription-management__renew').exists()).toBe(false);
        });

        it('offers to renew a subscription whose cancellation has yet to take effect', () => {
            const wrapper = mountComponent({ subscription: cancelledSubscription });

            expect(wrapper.find('.sv-subscription-management__renew').text()).toBe(
                'Renew subscription',
            );
            expect(wrapper.find('.sv-subscription-management__cancel').exists()).toBe(false);
        });

        it('loads neither the modal nor the customer until the customer asks to cancel', () => {
            const wrapper = mountComponent({ subscription: runningSubscription });

            expect(findModal(wrapper).exists()).toBe(false);
            expect(mockFetchCustomer).not.toHaveBeenCalled();
        });

        it('confirms the cancellation in the modal, dated for the customer', async () => {
            const wrapper = mountComponent({ subscription: runningSubscription });

            await wrapper.find('.sv-subscription-management__cancel').trigger('click');
            await flushPromises();

            const modal = findModal(wrapper);
            expect(modal.props('showModal')).toBe(true);
            expect(modal.props('variant')).toBe('CANCEL');
            expect(modal.props('paymentMethod')).toEqual(savedPaymentMethod);
            expect(mockFetchCustomer).toHaveBeenCalledTimes(1);
            expect(modal.props('customer')).toEqual({
                id: 'cus_123',
                timezone: 'Europe/Amsterdam',
            });
        });

        it('confirms a renewal in the same modal', async () => {
            const wrapper = mountComponent({ subscription: cancelledSubscription });

            await wrapper.find('.sv-subscription-management__renew').trigger('click');
            await flushPromises();

            expect(findModal(wrapper).props('variant')).toBe('RENEW');
        });

        it('reloads the subscription and says so once the cancellation is confirmed', async () => {
            const wrapper = mountComponent({ subscription: runningSubscription });
            await wrapper.find('.sv-subscription-management__cancel').trigger('click');
            await flushPromises();
            mockGet.mockClear();

            findModal(wrapper).vm.$emit('confirmed');
            await flushPromises();

            expect(mockGet).toHaveBeenCalled();
            expect(wrapper.find('.sv-subscription-management__cancellation-success').exists()).toBe(
                true,
            );
        });

        it('closes the modal without changing anything when it is dismissed', async () => {
            const wrapper = mountComponent({ subscription: runningSubscription });
            await wrapper.find('.sv-subscription-management__cancel').trigger('click');
            await flushPromises();

            findModal(wrapper).vm.$emit('close');
            await flushPromises();

            expect(findModal(wrapper).props('showModal')).toBe(false);
            expect(wrapper.find('.sv-subscription-management__cancellation-success').exists()).toBe(
                false,
            );
        });
    });
});
