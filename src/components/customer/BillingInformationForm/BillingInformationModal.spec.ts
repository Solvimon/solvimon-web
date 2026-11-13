import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import BillingInformationModal from './BillingInformationModal.vue';

vi.mock('@/services/customer', () => ({
    createCustomerService: () => ({ checkTaxID: vi.fn() }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Modal: defineComponent({
            name: 'ModalStub',
            props: { showModal: Boolean, title: String, confirmButtonText: String },
            emits: ['confirm', 'close'],
            template: `<div v-if="showModal" role="dialog" :aria-label="title">
                <slot name="body" />
                <button data-testid="confirm" @click="$emit('confirm')">{{ confirmButtonText }}</button>
                <button data-testid="close" @click="$emit('close')">close</button>
            </div>`,
        }),
        CountrySelect: defineComponent({
            name: 'CountrySelectStub',
            props: { singleModelValue: String },
            template: '<input data-testid="country" :value="singleModelValue" />',
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div role="alert">{{ title }}</div>',
        }),
    });
});

const customer = {
    id: 'cus_1',
    email: 'billing@example.com',
    type: 'INDIVIDUAL',
    individual: {
        name: { first_name: 'John', last_name: 'Doe' },
        residential_address: {
            line1: 'Dam 1',
            postal_code: '1012 JS',
            city: 'Amsterdam',
            country: 'NL',
        },
    },
} as unknown as Customer;

const mountModal = (execute: (payload: Partial<Customer>) => Promise<Customer>) => {
    const error = ref<Error | null>(null);
    const pending = ref(false);
    const update = {
        execute: vi.fn(async (payload: Partial<Customer>) => {
            pending.value = true;
            try {
                return await execute(payload);
            } catch (failure) {
                error.value = failure as Error;
                throw failure;
            } finally {
                pending.value = false;
            }
        }),
        error,
        isPending: computed(() => pending.value),
    };
    const wrapper = mount(BillingInformationModal, {
        props: {
            showModal: true,
            customer,
            update: update as unknown as InstanceType<
                typeof BillingInformationModal
            >['$props']['update'],
        },
    });

    return { wrapper, update };
};

describe('BillingInformationModal', () => {
    it('saves from its own button and closes once the change is stored', async () => {
        const { wrapper, update } = mountModal((payload) =>
            Promise.resolve({ ...customer, ...payload } as Customer),
        );

        expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
        await wrapper.find('input[type="email"]').setValue('edited@example.com');
        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();

        expect(update.execute).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'edited@example.com' }),
        );
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('stays open while the API refuses the change', async () => {
        const { wrapper } = mountModal(() => Promise.reject(new Error('refused')));

        await wrapper.find('input[type="email"]').setValue('edited@example.com');
        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.find('form').exists()).toBe(true);
    });

    it('does not close while a save is still out', async () => {
        const { wrapper } = mountModal(() => new Promise<Customer>(() => {}));

        await wrapper.find('input[type="email"]').setValue('edited@example.com');
        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();
        await wrapper.find('[data-testid="close"]').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
    });
});
