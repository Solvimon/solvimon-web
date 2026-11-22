<script setup lang="ts" generic="T">
import { computed } from 'vue';
import { Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { LimitedListProps } from './LimitedList.types';

const props = defineProps<LimitedListProps<T>>();

defineSlots<{
    /** One item. */
    item(props: { item: T }): unknown;
    /** The text of the card counting the items left out. Defaults to "+ {count} more". */
    more?(props: { count: number }): unknown;
}>();

const { $t } = useIntl();

const shownItems = computed(() => props.items.slice(0, props.limit));

const hiddenCount = computed(() => props.items.length - shownItems.value.length);
</script>

<template>
    <ul class="sv-limited-list grid grid-cols-1 gap-1">
        <li v-for="item in shownItems" :key="itemKey(item)" :class="itemClass">
            <slot name="item" :item="item" />
        </li>
        <li v-if="hiddenCount > 0" :class="moreClass">
            <Section no-spacing content-classes="px-4 py-3 text-center">
                <Typography tag="span" weight="semibold" color="secondary" no-spacing>
                    <slot name="more" :count="hiddenCount">{{
                        $t(
                            {
                                defaultMessage: '+ {count} more',
                                id: 'limited_list.more',
                                description:
                                    'Card below a shortened list with the number of items it leaves out',
                            },
                            { count: String(hiddenCount) },
                        )
                    }}</slot>
                </Typography>
            </Section>
        </li>
    </ul>
</template>
