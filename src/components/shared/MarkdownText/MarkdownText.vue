<script setup lang="ts">
import { computed } from 'vue';
import MarkdownInline from './MarkdownInline.vue';
import { parseMarkdownSubset } from '@/utils/markdownSubset';

const props = defineProps<{ source?: string | null }>();

const paragraphs = computed(() => parseMarkdownSubset(props.source));
</script>

<template>
    <div v-if="paragraphs.length">
        <p v-for="(paragraph, index) in paragraphs" :key="index" :class="{ 'mt-2': index > 0 }">
            <MarkdownInline :nodes="paragraph.children" />
        </p>
    </div>
</template>
