<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Button, Icon, Input, Section, Typography, useIntl } from '@solvimon/ui';
import { uniqueId } from 'lodash-es';
import type {
    PromotionCodeSectionEmits,
    PromotionCodeSectionProps,
} from './PromotionCodeSection.types';

const { $t } = useIntl();

const props = withDefaults(defineProps<PromotionCodeSectionProps>(), {
    promotionCode: null,
});

const emit = defineEmits<PromotionCodeSectionEmits>();

const isExpanded = ref(false);
const inputValue = ref('');
const statusMessage = ref('');
const toggleRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const baseId = uniqueId('promotion-code-');
const labelId = `${baseId}-label`;
const panelId = `${baseId}-panel`;

const isApplied = computed(() => props.promotionCode !== null && props.promotionCode !== '');
const canApply = computed(() => inputValue.value.trim().length > 0);
const appliedLabel = computed(
    () =>
        props.promotionCode ??
        $t({
            defaultMessage: 'Promotion applied',
            id: 'checkout.promotion_code.applied_label',
            description: 'Fallback label for an applied promotion code in checkout',
        }),
);
const toggleAriaLabel = computed(() =>
    $t({
        defaultMessage: isExpanded.value
            ? 'Collapse promotion code input'
            : 'Expand promotion code input',
        id: isExpanded.value
            ? 'checkout.promotion_code.collapse_aria_label'
            : 'checkout.promotion_code.expand_aria_label',
        description: 'Aria label for the promotion code toggle button in checkout',
    }),
);
const applyAriaLabel = computed(() =>
    $t({
        defaultMessage: 'Apply promotion code',
        id: 'checkout.promotion_code.apply_aria_label',
        description: 'Aria label for the promotion code apply button in checkout',
    }),
);
const removeAriaLabel = computed(() =>
    $t({
        defaultMessage: 'Remove promotion code',
        id: 'checkout.promotion_code.remove_aria_label',
        description: 'Aria label for the promotion code remove button in checkout',
    }),
);

const clearInput = () => {
    inputValue.value = '';
};

const focusInput = () => {
    const inputEl = panelRef.value?.querySelector('input');
    if (inputEl instanceof HTMLInputElement) {
        inputEl.focus();
    }
};

const collapseExpanded = () => {
    if (!isExpanded.value) {
        return;
    }
    isExpanded.value = false;
};

const toggleExpanded = () => {
    if (isApplied.value) {
        return;
    }
    isExpanded.value = !isExpanded.value;
};

const applyCode = () => {
    if (!canApply.value) {
        return;
    }
    const value = inputValue.value.trim();
    emit('update:appliedCode', value);
    emit('apply', value);
    statusMessage.value = $t({
        defaultMessage: 'Promotion code applied',
        id: 'checkout.promotion_code.applied_status',
        description: 'Aria live message when a promotion code is applied in checkout',
    });
    isExpanded.value = false;
};

const removeCode = () => {
    emit('update:appliedCode', null);
    emit('remove');
    statusMessage.value = $t({
        defaultMessage: 'Promotion code removed',
        id: 'checkout.promotion_code.removed_status',
        description: 'Aria live message when a promotion code is removed in checkout',
    });
    clearInput();
    void nextTick(() => {
        toggleRef.value?.focus();
    });
};

watch(isExpanded, (expanded) => {
    if (!expanded) {
        clearInput();
        void nextTick(() => {
            toggleRef.value?.focus();
        });
        return;
    }
    void nextTick(() => {
        focusInput();
    });
});

watch(
    () => props.promotionCode,
    (value) => {
        if (!value) {
            clearInput();
        }
    },
);
</script>

<template>
    <Section v-if="!isApplied" no-spacing class="w-full relative">
        <button
            ref="toggleRef"
            type="button"
            class="w-full"
            :aria-expanded="isExpanded"
            :aria-controls="panelId"
            :aria-label="toggleAriaLabel"
            @click="toggleExpanded"
        >
            <div
                class="flex flex-row items-center justify-between w-full gap-3 px-3 py-2 cursor-pointer"
            >
                <div class="flex flex-row gap-2 items-center">
                    <Icon icon="local_activity" />
                    <Typography :id="labelId" variant="body-sm">
                        {{
                            $t({
                                defaultMessage: 'Add promotion code',
                                id: 'checkout.promotion_code.add_label',
                                description: 'Label for adding a promotion code in checkout',
                            })
                        }}
                    </Typography>
                </div>
                <Icon :icon="isExpanded ? 'remove' : 'add'" />
            </div>
        </button>

        <div
            v-show="isExpanded"
            :id="panelId"
            ref="panelRef"
            role="region"
            :aria-labelledby="labelId"
            class="w-full border-t px-3 py-2 flex flex-row gap-2 items-center overflow-hidden"
            @keydown.esc.prevent="collapseExpanded"
        >
            <Input
                v-model="inputValue"
                :placeholder="
                    $t({
                        defaultMessage: 'Promotion code',
                        id: 'checkout.promotion_code.placeholder',
                        description: 'Placeholder for promotion code input in checkout',
                    })
                "
                :aria-label="
                    $t({
                        defaultMessage: 'Promotion code',
                        id: 'checkout.promotion_code.input_aria_label',
                        description: 'Aria label for promotion code input in checkout',
                    })
                "
                class="w-full"
                @keydown.enter.prevent="applyCode"
            />
            <Button
                type="button"
                :disabled="!canApply"
                :aria-label="applyAriaLabel"
                :aria-disabled="!canApply"
                @click="applyCode"
            >
                {{
                    $t({
                        defaultMessage: 'Apply',
                        id: 'checkout.promotion_code.apply_button',
                        description: 'Button label for applying a promotion code in checkout',
                    })
                }}
            </Button>
        </div>
    </Section>

    <Section v-else no-border no-spacing content-background="none" class="w-full relative">
        <button
            type="button"
            class="w-full bg-white border border-primary-900 rounded"
            :aria-label="removeAriaLabel"
            @click="removeCode"
        >
            <div
                class="flex flex-row items-center justify-between w-full gap-3 px-3 py-2 cursor-pointer"
            >
                <div class="flex flex-row gap-2 items-center">
                    <Icon icon="local_activity" />
                    <Typography variant="body-sm" class="font-semibold">
                        {{ appliedLabel }}
                    </Typography>
                </div>
                <Icon icon="close" />
            </div>
        </button>
    </Section>
    <span class="sr-only" aria-live="polite">{{ statusMessage }}</span>
</template>
