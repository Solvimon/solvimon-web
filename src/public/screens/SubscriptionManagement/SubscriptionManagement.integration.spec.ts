import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref } from 'vue';
import type { PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import SubscriptionManagement from './SubscriptionManagement.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const {
    mockUseSubscription,
    mockUseLoadInitialData,
    mockUsePaymentMethods,
    mockUseCustomer,
    mockUseUpgradePreview,
    mockLoadPreview,
    mockGet,
    mockFetchAll,
    mockDispatchAction,
    mockCreatePricingPlanSchedule,
} = vi.hoisted(() => ({
    mockUseSubscription: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockUsePaymentMethods: vi.fn(),
    mockUseCustomer: vi.fn(),
    mockUseUpgradePreview: vi.fn(),
    mockLoadPreview: vi.fn(),
    mockGet: vi.fn(),
    mockFetchAll: vi.fn(),
    mockDispatchAction: vi.fn(),
    mockCreatePricingPlanSchedule: vi.fn(),
}));

vi.mock('@/services/pricingPlanSchedules', () => ({
    createPricingPlanSchedulesService: () => ({
        createPricingPlanSchedule: mockCreatePricingPlanSchedule,
    }),
}));

vi.mock('@/composables/useCustomer', () => ({ useCustomer: mockUseCustomer }));

vi.mock('@/composables/usePaymentMethodOptions', () => ({
    usePaymentMethodOptions: () => ({ paymentMethodOptions: ref([]), get: vi.fn() }),
}));

vi.mock('@/components/payments/AddPaymentMethodModal/AddPaymentMethodModal.vue', () => ({
    default: defineComponent({
        name: 'AddPaymentMethodModalStub',
        props: { showModal: Boolean, customer: Object, paymentMethodOptions: Array },
        emits: ['success', 'failure', 'close'],
        setup: (props) => () =>
            h('div', {
                class: 'sv-add-payment-method-modal-stub',
                'data-open': String(props.showModal),
            }),
    }),
}));

vi.mock('@/composables/useSubscriptionUpgradePreview', () => ({
    useSubscriptionUpgradePreview: mockUseUpgradePreview,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    const { createTestPortalObject: createPortal } = await import('@/test-utils/portalObjectFixture');
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
            pricingGroup: { type: Object, required: true },
            paymentMethods: { type: Array, default: () => [] },
            paymentMethodOptions: { type: Array, default: undefined },
            billingPeriod: { type: Object, required: true },
            enabledPricingIds: { type: Array, required: true },
            paymentMethodId: String,
        },
        emits: ['add-payment-method', 'update:paymentMethodId'],
        // The real form opens on a payment method of its own accord, which the screen leans on.
        setup: (props, { emit }) => {
            onMounted(() => {
                const [first] = props.paymentMethods as { id: string }[];

                if (first) {
                    emit('update:paymentMethodId', first.id);
                }
            });

            return () => h('div', { class: 'sv-subscription-management-form-stub' });
        },
    }),
}));

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
const savedPaymentMethod = { id: 'pm_saved' } as unknown as PaymentMethod;

const mountComponent = ({
    enabledPricingId,
    subscription = mockSubscription,
    paymentMethods = [savedPaymentMethod],
    isLoading = false,
    extraEnabledPricingIds = [] as string[],
}: {
    enabledPricingId?: string;
    paymentMethods?: PaymentMethod[];
    isLoading?: boolean;
    extraEnabledPricingIds?: string[];
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
        error: ref(undefined),
    });
    mockUsePaymentMethods.mockReturnValue({ items: ref(paymentMethods), fetchAll: mockFetchAll });
    mockUseCustomer.mockReturnValue({
        customer: ref({ id: 'cus_123' }),
        get: { execute: vi.fn() },
    });
    mockUseUpgradePreview.mockReturnValue({
        invoice: ref(undefined),
        isPending: ref(false),
        error: ref(undefined),
        load: mockLoadPreview,
    });
    mockUseLoadInitialData.mockReturnValue({ isLoading: ref(isLoading) });

    return mount(SubscriptionManagement, {
        props: { configuration: { subscriptionId: 'ppsu_1', enabledPricingId } },
    });
};

describe('SubscriptionManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreatePricingPlanSchedule.mockResolvedValue({ id: 'ppsc_new' });
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
                wrapper.findComponent({ name: 'SubscriptionManagementForm' }).props(
                    'enabledPricingIds',
                ),
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

    describe('adding a payment method', () => {
        const openAddPaymentMethod = async (wrapper: ReturnType<typeof mountComponent>) => {
            wrapper.findComponent({ name: 'SubscriptionManagementForm' }).vm.$emit(
                'add-payment-method',
            );
            await wrapper.vm.$nextTick();

            return wrapper;
        };

        it('keeps the modal closed until the customer asks for it', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-add-payment-method-modal-stub').attributes('data-open')).toBe(
                'false',
            );
        });

        it('opens the modal over the plan choice, which stays on screen', async () => {
            const wrapper = await openAddPaymentMethod(
                mountComponent({ enabledPricingId: 'pri_1000' }),
            );

            expect(wrapper.find('.sv-add-payment-method-modal-stub').attributes('data-open')).toBe(
                'true',
            );
            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(true);
        });

        it('closes the modal when the customer dismisses it', async () => {
            const wrapper = await openAddPaymentMethod(
                mountComponent({ enabledPricingId: 'pri_1000' }),
            );

            wrapper.findComponent({ name: 'AddPaymentMethodModalStub' }).vm.$emit('close');
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.sv-add-payment-method-modal-stub').attributes('data-open')).toBe(
                'false',
            );
        });

        it('reloads the payment methods once one is stored, then closes', async () => {
            const wrapper = await openAddPaymentMethod(
                mountComponent({ enabledPricingId: 'pri_1000' }),
            );

            wrapper.findComponent({ name: 'AddPaymentMethodModalStub' }).vm.$emit('success');
            await flushPromises();

            expect(mockFetchAll).toHaveBeenCalled();
            expect(wrapper.find('.sv-add-payment-method-modal-stub').attributes('data-open')).toBe(
                'false',
            );
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

        it('starts a new schedule with the pricings that are selected', async () => {
            await update(mountComponent({ enabledPricingId: 'pri_5000' }));

            expect(mockCreatePricingPlanSchedule).toHaveBeenCalledWith({
                pricingPlanSubscriptionId: 'ppsu_1',
                enabledPricings: [{ pricing_id: 'pri_5000' }],
            });
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
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_1000' }));

            expect(
                wrapper.findComponent({ name: 'SubscriptionManagementSuccess' }).props(
                    'pricingGroupName',
                ),
            ).toBe('Credit packs');
        });

        it('stops offering the change once it is committed', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_1000' }));

            expect(wrapper.find('.sv-subscription-management__form').exists()).toBe(false);
            expect(wrapper.find('.sv-subscription-management__summary').exists()).toBe(false);
            expect(wrapper.find('.sv-subscription-management__update').exists()).toBe(false);
        });

        it('stays put until the customer is done reading the confirmation', async () => {
            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_1000' }));

            expect(mockDispatchAction).not.toHaveBeenCalled();

            await wrapper.find('.sv-subscription-management__done').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'navigate-to-customer-overview',
            });
        });

        it('reports a failure and stays put', async () => {
            mockCreatePricingPlanSchedule.mockRejectedValue(new Error('nope'));

            const wrapper = await update(mountComponent({ enabledPricingId: 'pri_1000' }));

            expect(wrapper.find('.sv-subscription-management__update-error').exists()).toBe(true);
            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('cannot be submitted while the initial data is still loading', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000', isLoading: true });

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeDefined();
        });

        it('cannot be submitted until something pays for the change', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000', paymentMethods: [] });
            await flushPromises();

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeDefined();
        });

        it('can be submitted once a payment method is selected', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });
            await flushPromises();

            expect(
                wrapper.find('.sv-subscription-management__update').attributes('disabled'),
            ).toBeUndefined();
        });

        it('does not commit anything while no payment method is selected', async () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000', paymentMethods: [] });

            await update(wrapper);

            expect(mockCreatePricingPlanSchedule).not.toHaveBeenCalled();
        });

        it('renders the secure payments KPI below it', () => {
            const wrapper = mountComponent({ enabledPricingId: 'pri_1000' });

            expect(wrapper.find('.sv-subscription-management__kpi').exists()).toBe(true);
        });
    });
});
