<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Section, Typography, PaymentMethod, useIntl } from '@solvimon/solvimon-ui';
import type {
    PaymentMethod as PaymentMethodType,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import { createPaymentMethodsService } from '@/services/paymentMethods';

const props = defineProps<{
    customerId: string;
    subscriptionId: string;
    selectedId?: string;
}>();

const emit = defineEmits<{
    (e: 'select', id: string): void;
}>();

const { $t } = useIntl();

// Must be called in setup scope — inject() is not available after component mount.
const { getPaymentMethods, getPaymentMethodOptions } = createPaymentMethodsService();

const savedMethods = ref<PaymentMethodType[]>([]);
const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);
const isPending = ref(false);

/**
 * Flatten options from all payment acceptors into a single list.
 * The unique key per option is `adyen.type` (e.g. "ideal", "scheme", "paypal").
 */
const newOptions = computed(() =>
    paymentMethodOptions.value.flatMap((entry) => entry.options ?? []),
);

/**
 * Adyen CDN logo URL — the same source the Adyen dropin uses internally.
 * The `type` field from the options response (e.g. "ideal", "paypal") maps directly.
 */
const adyenLogoUrl = (type: string) =>
    `https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/${type}.svg`;

/**
 * Small brand logos (e.g. "mc", "visa") for card scheme rows.
 */
const adyenBrandLogoUrl = (brand: string) =>
    `https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/small/${brand}.svg`;

/** Brands to display for card scheme rows — show recognisable ones first, cap at 4. */
const PREFERRED_BRANDS = ['visa', 'mc', 'amex', 'maestro'];

const displayBrands = (brands: string[] | undefined) => {
    if (!brands) return [];
    const preferred = PREFERRED_BRANDS.filter((b) => brands.includes(b));
    const rest = brands.filter((b) => !PREFERRED_BRANDS.includes(b));
    return [...preferred, ...rest].slice(0, 4);
};

onMounted(async () => {
    isPending.value = true;
    try {
        const savedResponse = await getPaymentMethods({
            customerId: props.customerId,
            pagination: { page: 1, pageSize: 50 },
        });
        const optionsResponse = await getPaymentMethodOptions({
            customerId: props.customerId,
        });
        savedMethods.value = savedResponse.data;
        paymentMethodOptions.value = optionsResponse;
    } finally {
        isPending.value = false;
    }
});
</script>

<template>
    <div class="sv-payment-method-picker flex flex-col gap-4">
        <!-- Saved payment methods -->
        <div
            v-if="savedMethods.length > 0"
            class="sv-payment-method-picker__saved flex flex-col gap-2"
        >
            <Typography variant="heading-3" tag="h2" class="sv-payment-method-picker__title">{{
                $t({
                    defaultMessage: 'Saved payment methods',
                    id: 'upgrade_subscription.payment_picker.saved_title',
                    description:
                        'Heading for the saved payment methods section in the upgrade subscription payment picker',
                })
            }}</Typography>
            <div class="sv-payment-method-picker__options flex flex-col gap-1">
                <Section
                    v-for="method in savedMethods"
                    :key="method.id"
                    :content-background="selectedId === method.id ? 'none' : 'gray'"
                    :class="{ 'sv-payment-method-picker__option--selected !bg-white': selectedId === method.id }"
                    class="sv-payment-method-picker__option cursor-pointer"
                    @click="emit('select', method.id)"
                >
                    <PaymentMethod
                        class="sv-payment-method-picker__option-content"
                        :payment-method="method"
                    />
                </Section>
            </div>
        </div>

        <!-- All payment methods (new) -->
        <div
            v-if="newOptions.length > 0"
            class="sv-payment-method-picker__new flex flex-col gap-2"
        >
            <Typography variant="heading-3" tag="h2" class="sv-payment-method-picker__title">{{
                $t({
                    defaultMessage: 'All payment methods',
                    id: 'upgrade_subscription.payment_picker.all_title',
                    description:
                        'Heading for the all payment methods section in the upgrade subscription payment picker',
                })
            }}</Typography>
            <div class="sv-payment-method-picker__options flex flex-col gap-1">
                <Section
                    v-for="option in newOptions"
                    :key="option.adyen.type"
                    :content-background="selectedId === option.adyen.type ? 'none' : 'gray'"
                    :class="{
                        'sv-payment-method-picker__option--selected !bg-white':
                            selectedId === option.adyen.type,
                    }"
                    class="sv-payment-method-picker__option cursor-pointer"
                    @click="emit('select', option.adyen.type)"
                >
                    <div class="sv-payment-method-picker__option-content flex items-center gap-3">
                        <!-- Card brands for scheme: show recognised brands side by side -->
                        <div
                            v-if="option.adyen.type === 'scheme'"
                            class="sv-payment-method-picker__option-icon flex h-9 w-9 shrink-0 items-center gap-0.5"
                        >
                            <img
                                v-for="brand in displayBrands(option.adyen.brands)"
                                :key="brand"
                                :src="adyenBrandLogoUrl(brand)"
                                :alt="brand"
                                class="h-5 w-auto rounded"
                            />
                        </div>

                        <!-- Single logo for all other payment types -->
                        <div
                            v-else
                            class="sv-payment-method-picker__option-icon flex h-9 w-9 shrink-0 items-center justify-center overflow-clip rounded"
                        >
                            <img
                                :src="adyenLogoUrl(option.adyen.type)"
                                :alt="option.name"
                                class="h-9 w-9 object-contain"
                            />
                        </div>

                        <Typography variant="body-sm" class="sv-payment-method-picker__option-label">{{ option.name }}</Typography>
                    </div>
                </Section>
            </div>
        </div>

        <!-- Loading skeleton placeholder -->
        <div v-if="isPending" class="sv-payment-method-picker__loading flex flex-col gap-1">
            <div class="sv-skeleton h-[52px] animate-pulse rounded-md bg-gray-100" />
            <div class="sv-skeleton h-[52px] animate-pulse rounded-md bg-gray-100" />
            <div class="sv-skeleton h-[52px] animate-pulse rounded-md bg-gray-100" />
        </div>
    </div>
</template>
