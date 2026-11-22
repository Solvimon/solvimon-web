<script setup lang="ts" generic="T">
import { computed } from 'vue';
import { Icon, useIntl } from '@solvimon/solvimon-ui';
import type { LimitedListProps } from './LimitedList.types';

const props = defineProps<LimitedListProps<T>>();

defineSlots<{
    /** One item. */
    item(props: { item: T }): unknown;
    /** The text counting the items left out. Defaults to "+ {count} more". */
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
        <li v-if="hiddenCount > 0" class="flex" :class="moreClass">
            <button
                v-if="showAll"
                type="button"
                class="sv-action sv-action--link ml-auto inline-flex items-center gap-1 rounded text-xs text-primary-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                @click="showAll"
            >
                {{
                    $t(
                        {
                            defaultMessage: 'Show all {count}',
                            id: 'limited_list.show_all',
                            description:
                                'Link below a shortened list that opens all of its items, with how many there are',
                        },
                        { count: String(items.length) },
                    )
                }}
                <Icon icon="arrow_right_alt" size="xs" />
            </button>
            <span v-else class="text-xs text-primary-900">
                <slot name="more" :count="hiddenCount">{{
                    $t(
                        {
                            defaultMessage: '+ {count} more',
                            id: 'limited_list.more',
                            description:
                                'Text below a shortened list with the number of items it leaves out',
                        },
                        { count: String(hiddenCount) },
                    )
                }}</slot>
            </span>
        </li>
    </ul>
</template>
