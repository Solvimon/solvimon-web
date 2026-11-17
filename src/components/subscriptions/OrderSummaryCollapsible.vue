<script setup lang="ts">
import { Amount as AmountDisplay, Expand, Icon, Section, Typography } from '@solvimon/solvimon-ui';
import type { Amount } from '@solvimon/solvimon-types';
import { ref, useId } from 'vue';

/** A card of the order summary that opens on its title to show its default slot. */
withDefaults(
    defineProps<{ title: string; subtitle?: string; total?: Amount; expandable?: boolean }>(),
    {
        subtitle: undefined,
        total: undefined,
        expandable: true,
    },
);

const isExpanded = ref(false);
const panelId = useId();
</script>

<template>
    <Section
        no-spacing
        :content-background="isExpanded ? 'none' : 'gray'"
        :content-classes="`transition duration-300 ease-in-out${isExpanded ? ' bg-white shadow-[0_0_0_2px_rgb(0_0_0/0.04)]' : ''}`"
    >
        <div v-if="!expandable" class="px-3 py-2">
            <Typography no-spacing variant="body-sm" color="subtle">{{ title }}</Typography>
        </div>
        <button
            v-else
            type="button"
            class="flex w-full cursor-pointer flex-row items-center justify-between gap-3 px-3 py-2 text-left"
            :aria-expanded="isExpanded"
            :aria-controls="panelId"
            @click="isExpanded = !isExpanded"
        >
            <span class="flex flex-row flex-wrap items-baseline gap-x-2">
                <Typography no-spacing tag="span" variant="body-sm" weight="semibold">
                    {{ title }}
                </Typography>
                <Typography v-if="subtitle" no-spacing tag="span" variant="body-xs" color="subtle">
                    {{ subtitle }}
                </Typography>
            </span>
            <span class="flex shrink-0 flex-row items-center gap-1">
                <!-- As the invoice preview's tax amount. -->
                <Typography
                    v-if="total"
                    no-spacing
                    tag="span"
                    variant="body-xs"
                    weight="medium"
                    class="whitespace-nowrap tabular-nums"
                >
                    <AmountDisplay :value="total" />
                </Typography>
                <!-- The arrow fills the middle half of its box; this lines it up with the amounts. -->
                <Icon
                    icon="keyboard_arrow_down"
                    size="xs"
                    class="-mr-1 transition ease-in-out"
                    :class="{ 'rotate-180': isExpanded }"
                />
            </span>
        </button>

        <div v-if="expandable" :id="panelId" :inert="!isExpanded || undefined">
            <Expand :is-open="isExpanded" lazy>
                <div class="border-t px-3 py-2">
                    <slot />
                </div>
            </Expand>
        </div>
    </Section>
</template>
